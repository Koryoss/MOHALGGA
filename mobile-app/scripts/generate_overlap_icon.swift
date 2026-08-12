import AppKit

let size = CGFloat(1024)
let image = NSImage(size: NSSize(width: size, height: size))
image.lockFocus()

NSColor(red: 244/255, green: 240/255, blue: 230/255, alpha: 1).setFill()
NSBezierPath(roundedRect: NSRect(x: 0, y: 0, width: size, height: size), xRadius: 220, yRadius: 220).fill()

func lens(_ top: CGFloat, _ left: CGFloat, _ upperControlY: CGFloat, _ lowerControlY: CGFloat, _ right: CGFloat, _ bottom: CGFloat, color: NSColor) {
  let path = NSBezierPath()
  path.move(to: NSPoint(x: 512, y: top))
  path.curve(to: NSPoint(x: 512, y: bottom), controlPoint1: NSPoint(x: left, y: upperControlY), controlPoint2: NSPoint(x: left, y: lowerControlY))
  path.curve(to: NSPoint(x: 512, y: top), controlPoint1: NSPoint(x: right, y: lowerControlY), controlPoint2: NSPoint(x: right, y: upperControlY))
  path.close()
  color.setFill()
  path.fill()
}

lens(254, 281, 377, 647, 743, 770, color: NSColor(red: 41/255, green: 40/255, blue: 36/255, alpha: 1))
lens(302, 337, 403, 621, 687, 722, color: NSColor(red: 222/255, green: 121/255, blue: 103/255, alpha: 1))

image.unlockFocus()
let bitmap = NSBitmapImageRep(data: image.tiffRepresentation!)!
let data = bitmap.representation(using: .png, properties: [:])!
try data.write(to: URL(fileURLWithPath: "assets/images/whatshallwe-overlap-icon.png"))
