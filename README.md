# fla_transfer

注意：

1. 仅在 Adobe Flash CS6 Professional、Windows 11、Python 3.11.5 做了有限的测试
2. 建议操作系统为 Windows，否则需要改 `jsfl` 文件中 Path 的斜杠和反斜杠
3. 建议自带终端对 Python 的 alias 为 `python`，否则需要改 `jsfl` 文件中的 `runCommandLine` 部分

动画注意：

1. 第一个场景需为元件，所有动画放在这个元件里
2. 动画第一个图层为空，用名字标明动画名字
3. 如果动画有位移，图层名字需为 `_ground`
   - 位移图层会自动计算变速帧事件，帧事件名字为 `SETGS_{v}`，这里 v 是一个相对速度值，需要在 parse 时统一调整
4. 帧事件名加在对应关键帧的名字处即可
5. 支持变色和半透明
6. 修复了 cocostudio 中异常翻转的问题

