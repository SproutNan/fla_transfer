function simpleJSONStringify(obj) {
    var isArray = obj.constructor == Array;
    var result = isArray ? "[" : "{";
    var items = [];

    for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
            var value = obj[key];
            var item = "";

            if (typeof value === "string") {
                item = '"' + value + '"';
            } else if (typeof value === "number" || typeof value === "boolean") {
                item = value;
            } else if (typeof value === "object") {
                item = simpleJSONStringify(value);
            }

            if (!isArray) {
                item = '"' + key + '":' + item;
            }

            items.push(item);
        }
    }

    result += items.join(",");
    result += isArray ? "]" : "}";

    return result;
}

function extractPlist() {
	// Check if a document is open
	var doc = fl.getDocumentDOM();
	if (!doc) {
		fl.trace("No document open");
		return;
	}

	// Get the directory of the current FLA file and append 'imageLibrary' to it
	var flaFullPath = doc.path;
	var lastSlashIndex = flaFullPath.lastIndexOf('\\');
	var flaDirectory = flaFullPath.substr(0, lastSlashIndex);
	var flaName = (doc.name.substr(-4) === ".fla") ? doc.name.substr(0, doc.name.length - 4) : doc.name;
	
	var exportFolder = flaDirectory + "\\" + flaName + "\\" + "Resources";

	var exportFolderURI = FLfile.platformPathToURI(exportFolder);

	var bitmaps = doc.library.items.filter(function (item) {
		return item.itemType == "bitmap";
	});

	for (var i = 0; i < bitmaps.length; i++) {
		var bitmap = bitmaps[i];
		var bitmapName = (bitmap.name.substr(-4) === ".png") ? bitmap.name : bitmap.name + ".png";
		var exportPath = exportFolderURI + "/" + bitmapName;
		bitmap.exportToFile(exportPath);
	}

	// Run python script
	var pythonScriptPath = "\\generate_plist.py";
	FLfile.runCommandLine("python " + flaDirectory + pythonScriptPath + " " + flaName + " " + flaDirectory);
}

function extractAnimationData(export_status) {
	var doc = fl.getDocumentDOM();
	if (!doc) {
		fl.trace("No document open");
		return;
	}

	// 文件名
	var lastPoint = doc.name.lastIndexOf('.');
	var fla_name = doc.name.substr(0, lastPoint)

	// 获取第一个场景的第一个图层的第一个元件
	var elements = doc.timelines[0].layers[0].frames[0].elements;
	if (elements.length === 0) {
		fl.trace("fail: mainElement not found");
		return;
	}
	var mainElement = elements[0];
	if (mainElement.elementType != "instance") {
		fl.trace("fail: mainElement is not an instance");
	}

	var file = {
		"content_scale": 1.0,
		"armature_data": [{
			"strVersion": "1.6.0.0",
			"version": 1.6,
			"name": fla_name,
			"bone_data": []
		}],
		"animation_data": [{
			"name": fla_name,
			"mov_data": []
		}],
		"texture_data": [],
		"config_file_path": [],
		"config_png_path": []
	}
	// 开始处理时间线
	// 1. 时间线一共有多少帧？注意帧的起始下标是0
	var tl_dr = mainElement.libraryItem.timeline.frameCount;
	// 2. 每个图层，制成 armature_data
	var tl_layers = mainElement.libraryItem.timeline.layers;
	var tl_layerCount = tl_layers.length;

	for (var j = 1; j < tl_layerCount; j++) {
		var layer = tl_layers[j];
		var element = layer.frames[0].elements[0];
		var bone = {
			"name": layer.name,
			"parent": "",
			"dI": 0,
			"x": (element ? element.x : 0.0),
			"y": (element ? -element.y : 0.0),
			"z": tl_layerCount - j,
			"cX": (element ? element.scaleX : 1.0),
			"cY": (element ? element.scaleY : 1.0),
			"kX": (element ? element.skewX * 3.1415926 / 180 : 0.0),
			"kY": (element ? -element.skewY * 3.1415926 / 180 : 0.0),
			"arrow_x": 0.0,
			"arrow_y": 0.0,
			"effectbyskeleton": false,
			"bl": 0,
			"display_data": []
		}
		// 有的图层可能出现不同的元件（如鸭子僵尸的水）
		var used_map = {};
		for (var i = 0; i < tl_dr; i++) {
			var have_element = layer.frames[i].elements[0];
			if (have_element) {
				var bit_element = have_element.libraryItem.timeline.layers[0].frames[0].elements[0];
				var element_name = bit_element.libraryItem.name;
				if (!used_map.hasOwnProperty(element_name)) {
					used_map[element_name] = true;
					var bitmap = {
						"name": element_name,
						"displayType": 0,
						"skin_data": [
							{
								"x": 0,
								"y": 0,
								"cX": bit_element.scaleX,
								"cY": bit_element.scaleY,
								"kX": bit_element.skewX * 3.1415926 / 180,
								"kY": bit_element.skewY * 3.1415926 / 180
							}
						]
					}
					bone.display_data.push(bitmap)
				}
			}
		}
	    file.armature_data[0].bone_data.push(bone);
	}
	
	


	// 3. 一共有多少个动画？处理第一个控制图层
	var tl_ctrl = mainElement.libraryItem.timeline.layers[0].frames;
	var last_animation_name = "34267854356";
	var animations = [];
	for (var i = 0; i < tl_dr; i++) {
		if (tl_ctrl[i].name != last_animation_name) {
			animations.push([i, tl_ctrl[i].name]);
			last_animation_name = tl_ctrl[i].name;
		}
	}
	animations.push([tl_dr, "null"]);
	

	// 一共有多少个图层？
	var tl_lys = mainElement.libraryItem.timeline.layers.length;
	
	// 往 file 文件中填写动画
	var _last = 0;
	for (var i = 0; i < animations.length - 1; i++) {
	    var new_animation = {
			"name": animations[i][1],
			"dr": animations[i + 1][0] - _last - 1,
			"lp": true,
			"to": 0,
			"drTW": 0,
			"twE": 0,
			"sc": 0.4,
			"mov_bone_data": []
		}
		// 将所有图层信息全都放进去
		for (var j = 1; j < tl_lys; j++) {
		    var new_bone = {
				"name": mainElement.libraryItem.timeline.layers[j].name,
				"dl": 0.0,
				"frame_data": []
			}
			new_animation.mov_bone_data.push(new_bone);
		}
		// 将新的动画数组插入 animation_data 中
		file.animation_data[0].mov_data.push(new_animation);
		_last = animations[i + 1][0];
	}
	
	
	// 最后一帧之后的的哨兵是第几帧？
	var last_anim_frame = animations[animations.length - 1][0];
	// 下一个要分析的动画是从第几帧开始
	var next_anim_start_frame = 0;
	// 现在这个动画是从第几针开始
	var curr_anim_start_frame = -1;
	// 当前分析到第几个动画
	var curr_anim_index = -1;
	// 当前分析到第几帧(绝对帧数)
	var curr_anim_frame = -1;
	while (curr_anim_frame < last_anim_frame) {
		// 进入下一帧
		curr_anim_frame = curr_anim_frame + 1;
		if (curr_anim_frame == last_anim_frame) {
			break;
		}
		// 查看是否将进入新的动画，如果现在分析的新帧是下一个动画，则动画指针需要移动
		if (curr_anim_frame == next_anim_start_frame) {
			curr_anim_index = curr_anim_index + 1;
			// 更新下一个动画是从第几帧开始
			curr_anim_start_frame = animations[curr_anim_index][0];
			next_anim_start_frame = animations[curr_anim_index + 1][0];
		}
		// 现在，遍历这帧的所有 layers
		for (var _layer = 1; _layer < tl_lys; _layer++) {
			var curr_frame = mainElement.libraryItem.timeline.layers[_layer].frames[curr_anim_frame];
			if (curr_frame.startFrame == curr_anim_frame) {
				var _isEmpty = (curr_frame.elements.length ? false : true);
				var new_frame = {
                  "dI": (_isEmpty ? -1 : 0),
                  "x": (_isEmpty ? -file.armature_data[0].bone_data[_layer - 1].x : 0),
                  "y": (_isEmpty ? -file.armature_data[0].bone_data[_layer - 1].y : 0),
                  "z": 0,
                  "cX": 1.0,
                  "cY": 1.0,
                  "kX": 0,
                  "kY": 0,
                  "fi": curr_anim_frame - curr_anim_start_frame,
                  "twE": 0,
                  "tweenFrame": true,
                  "bd_src": 1,
                  "bd_dst": 771
				}
				// 加入帧事件
				if (curr_frame.name.length > 0) {
					new_frame["evt"] = curr_frame.name;
				}
				else if (mainElement.libraryItem.timeline.layers[_layer].name == "_ground" && !_isEmpty) {
					var duration = mainElement.libraryItem.timeline.layers[_layer].frames[curr_anim_frame].duration;
					// 下一个 ground 的位置
					var next_ground_index = curr_anim_frame + duration;
					if (next_ground_index < next_anim_start_frame) {
						var next_frame = mainElement.libraryItem.timeline.layers[_layer].frames[next_ground_index];
						var delta_x = (next_frame.elements[0].x - curr_frame.elements[0].x) * 1000;
						var speed = "SETGS_" + (delta_x / duration);
						var lastPeriod = speed.lastIndexOf('.');
						// round speed
						if (lastPeriod != -1) {
							var speed = speed.substr(0, lastPeriod);
						}
						new_frame["evt"] = speed;
					}
				}
				// 确定当前帧是不是第一个动画的第一帧
				// 跨动画的关键帧也用的是第一个动画的，所以
				var first_anim_first_frame = file.animation_data[0].mov_data[0].mov_bone_data[_layer - 1];
				// 第一个动画已经有关键帧了
				if (!_isEmpty && first_anim_first_frame.frame_data.length != 0) {
					new_frame.x = curr_frame.elements[0].x - file.armature_data[0].bone_data[_layer - 1].x;
					new_frame.y = -curr_frame.elements[0].y - file.armature_data[0].bone_data[_layer - 1].y;
					new_frame.cX = curr_frame.elements[0].scaleX - (file.armature_data[0].bone_data[_layer - 1].cX - first_anim_first_frame.frame_data[0].cX);
					new_frame.cY = curr_frame.elements[0].scaleY - (file.armature_data[0].bone_data[_layer - 1].cY - first_anim_first_frame.frame_data[0].cY);
					new_frame.kX = curr_frame.elements[0].skewX * 3.1415926 / 180 - (file.armature_data[0].bone_data[_layer - 1].kX - first_anim_first_frame.frame_data[0].kX);
					new_frame.kY = -curr_frame.elements[0].skewY * 3.1415926 / 180 - (file.armature_data[0].bone_data[_layer - 1].kY - first_anim_first_frame.frame_data[0].kY);
					var _a = parseInt(curr_frame.elements[0].colorAlphaPercent * 2.55, 10);
					var _r = curr_frame.elements[0].colorRedAmount;
					var _g = curr_frame.elements[0].colorGreenAmount;
					var _b = curr_frame.elements[0].colorBlueAmount;
					if (mainElement.libraryItem.timeline.layers[_layer].name == "_ground") {
						_a = 0;
					}
					if (_a < 254 || _r != 0 || _g != 0 || _b != 0) {
						new_frame["color"] = {
							a: 255,
							r: 255,
							g: 255,
							b: 255
						}
						new_frame.color.a = (_a < 254 ? _a : 255);
						new_frame.color.r = _r;
						new_frame.color.g = _g;
						new_frame.color.b = _b;
					}
				}
				// 确定display_Index
				
				if (!_isEmpty && _layer == 1) {
					var displaydata = file.armature_data[0].bone_data[_layer - 1].display_data;
					// 当前图层当前帧当前元件的display_data
					var bitmap_name = curr_frame.elements[0].libraryItem.timeline.layers[0].frames[0].elements[0].libraryItem.name;
					for (var k = 0; k < displaydata.length; k++) {
						if (displaydata[k].name == bitmap_name) {
							new_frame.dI = k;
							break;
						}
					}
				}
				file.animation_data[0].mov_data[curr_anim_index].mov_bone_data[_layer - 1].frame_data.push(new_frame);
			}
		}
	}
	
	// 把动画中没有帧的图层删了
	for (var k = 0; k < file.animation_data.length; k++) {
		for (var g = 0; g < file.animation_data[k].mov_data.length; g++) {
			file.animation_data[k].mov_data[g].mov_bone_data = file.animation_data[k].mov_data[g].mov_bone_data.filter(function(item) {
				return item.frame_data.length != 0;
			});
		}
	}
	
	// 4. 获取 texture_data
	var instances = doc.library.items.filter(function (item) {
		return item.itemType == "movie clip" && item.name[0] != "元";
	});

	var _used_bitmap = {};
	for (var i = 0; i < instances.length; i++) {
		var instance = instances[i];
		if (instance.timeline.layers[0].frames[0].elements[0].libraryItem.itemType == "bitmap") {
			var instance_bitmap_name = instance.timeline.layers[0].frames[0].elements[0].libraryItem.name;
			instance_bitmap_name = (instance_bitmap_name.substr(-4) === ".png") ? instance_bitmap_name.substr(0, instance_bitmap_name.length - 4) : instance_bitmap_name;
			if (!(instance_bitmap_name in _used_bitmap)) {
				_used_bitmap[instance_bitmap_name] = true;
				var new_texture = {
					"name": instance_bitmap_name,
					"width": instance.timeline.layers[0].frames[0].elements[0].width,
					"height": instance.timeline.layers[0].frames[0].elements[0].height,
					"pX": 0.0,
					"pY": 1.0,
					"plistFile": ""
				}
				file.texture_data.push(new_texture);
			}
		}
	}
	
	// 5. 填写path
	if (export_status) {
		file.config_file_path = fla_name + "0.plist";
		file.config_png_path = fla_name + "0.png";
	}
	
	return simpleJSONStringify(file);

	// 获取当前FLA的路径
	var currentPath = fl.getDocumentDOM().path;

	// 转换路径为URI格式
	var fileURI = "file:///" + currentPath.replace(/\\/g, '/') + "output.json";

	// 使用FLfile进行文件操作
	if (FLfile.exists(fileURI)) {
	    FLfile.remove(fileURI);
	}

	FLfile.write(fileURI, js);
}

function rulerXml(flaName) {
	var a = '<?xml version="1.0" encoding="utf-8"?>\n<ArrayOfGuidesProject xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">\n  <GuidesProject>\n    <Project>';
	a += flaName;
	a += "</Project>\n    <GuidesList />\n  </GuidesProject>\n</ArrayOfGuidesProject>";
	return a;
}

function xmlAnimation(flaDirPath, flaName) {
	var a = '<?xml version="1.0"?>\n<AnimationProject xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">\n  <ProjectDir>';
	a += flaDirPath;
	a += '</ProjectDir>\n  <Version>1.6.0.0</Version>\n  <Resources>';
	a += flaDirPath + '\\Resources';
	a += '</Resources>\n  <Name>';
	a += flaName;
	a += '</Name>\n  <JsonFileName>';
	a += flaName + '.json';
	a += '</JsonFileName>\n  <JsonFolder>';
	a += flaDirPath + '\\Json';
	a += '</JsonFolder>\n  <JsonList />\n  <CanvasSize>\n    <Width>0</Width>\n    <Height>0</Height>\n  </CanvasSize>\n  <filePath>';
	a += flaDirPath + '\\' + flaName + '.xml.animation';
	a += '</filePath>\n  <ProjectType>AnimationProject</ProjectType>\n  <ResRelativePath />\n  <ResourceFileList />\n  <bBatchImage>false</bBatchImage>\n</AnimationProject>';
	return a;
}

function build() {
	var doc = fl.getDocumentDOM();
	// 在 fla 的文件夹下创建与 fla 名同名的文件夹，然后注入文件夹结构
	var flaFullPath = doc.path;
	var targetExportPath = (doc.path.substr(-4) === ".fla") ? doc.path.substr(0, doc.path.length - 4) : doc.path;
	var flaName = (doc.name.substr(-4) === ".fla") ? doc.name.substr(0, doc.name.length - 4) : doc.name;
	
	var lastSlashIndex = flaFullPath.lastIndexOf('\\');
	var flaDirectory = flaFullPath.substr(0, lastSlashIndex) + flaName;
	
	var exportFolderURI = FLfile.platformPathToURI(targetExportPath);
	
	if (!FLfile.exists(exportFolderURI)) {
		FLfile.createFolder(exportFolderURI);
		fl.trace("[debug] Created folder: " + exportFolderURI);
	} else {
		fl.trace("[debug] Export folder already exists: " + exportFolderURI);
		fl.trace("[fatal] Please be sure that no folder's name is the same as the fla.");
		return;
	}
	FLfile.createFolder(exportFolderURI + '/Export');
	FLfile.createFolder(exportFolderURI + '/Json');
	FLfile.createFolder(exportFolderURI + '/Resources');
	FLfile.createFolder(exportFolderURI + '/Ruler');
	
	
	var json = extractAnimationData(false);
	var exportJson = extractAnimationData(true);
	FLfile.write(exportFolderURI + '/Json/' + flaName + ".json", json);
	FLfile.write(exportFolderURI + '/Export/' + flaName + ".ExportJson", exportJson);
	var rulerX = rulerXml(flaName);
	FLfile.write(exportFolderURI + '/Ruler/' + flaName + ".xml", rulerX);
	var xmlA = xmlAnimation(flaDirectory, flaName);
	FLfile.write(exportFolderURI + '/' + flaName + ".xml.animation", xmlA);
	
	extractPlist();
	fl.trace("[messg] Success!")
}

build();