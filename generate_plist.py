from PIL import Image
import os
from sys import argv

# Usage: python generate_plist.py [image_path] [fla_name]

if __name__ == "__main__":
    # Folder containing exported images
    script_folder = os.path.dirname(os.path.realpath(__file__))
    img_folder = os.path.join(script_folder, argv[1])
    export_folder = os.path.join(script_folder, "Export")
    if not os.path.exists(export_folder):
        os.mkdir(export_folder)
    sheet_name = argv[2] + '.png'
    output_spritesheet = os.path.join(export_folder, sheet_name)
    output_plist = os.path.join(export_folder, argv[2] + '.plist')

    images = [Image.open(os.path.join(img_folder, f)) for f in os.listdir(img_folder) if f.endswith('.png')]
    widths, heights = zip(*(i.size for i in images))

    total_width = sum(widths)
    max_height = max(heights)

    spritesheet = Image.new('RGBA', (total_width, max_height))

    x_offset = 0
    frames_data = {}
    for img, name in zip(images, os.listdir(img_folder)):
        spritesheet.paste(img, (x_offset, 0))
        frames_data[name] = {
            "width": img.width,
            "height": img.height,
            "originalWidth": img.width,
            "originalHeight": img.height,
            "x": x_offset,
            "y": 0,
            "offsetX": 0,
            "offsetY": 0
        }
        x_offset += img.width

    spritesheet.save(output_spritesheet)

    with open(output_plist, 'w') as f:
        f.write('<?xml version="1.0" encoding="utf-8"?>\n')
        f.write('<!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n')
        f.write('<plist version="1.0">\n')
        f.write('<dict>\n')
        f.write('    <key>frames</key>\n')
        f.write('    <dict>\n')
        for name, data in frames_data.items():
            f.write(f'        <key>{name}</key>\n')
            f.write('        <dict>\n')
            for key, value in data.items():
                if isinstance(value, int):
                    f.write(f'            <key>{key}</key>\n')
                    f.write(f'            <integer>{value}</integer>\n')
                else:  # assuming real/float
                    f.write(f'            <key>{key}</key>\n')
                    f.write(f'            <real>{value}</real>\n')
            f.write('        </dict>\n')
        f.write('    </dict>\n')
        f.write('    <key>metadata</key>\n')
        f.write('    <dict>\n')
        f.write(f'        <key>format</key>\n')
        f.write(f'        <integer>0</integer>\n')
        f.write(f'        <key>textureFileName</key>\n')
        f.write(f'        <string>{sheet_name}</string>\n')
        f.write(f'        <key>realTextureFileName</key>\n')
        f.write(f'        <string>{sheet_name}</string>\n')
        f.write(f'        <key>size</key>\n')
        f.write(f'        <string>{{{total_width},{max_height}}}</string>\n')
        f.write('    </dict>\n')
        f.write('    <key>texture</key>\n')
        f.write('    <dict>\n')
        f.write(f'        <key>width</key>\n')
        f.write(f'        <integer>{total_width}</integer>\n')
        f.write(f'        <key>height</key>\n')
        f.write(f'        <integer>{max_height}</integer>\n')
        f.write('    </dict>\n')
        f.write('</dict>\n')
        f.write('</plist>')

    # remove directory: img_folder
    for f in os.listdir(img_folder):
        os.remove(os.path.join(img_folder, f))
    os.rmdir(img_folder)
