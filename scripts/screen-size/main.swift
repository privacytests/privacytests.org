import Foundation
import CoreGraphics

func getMainDisplay() -> CGDirectDisplayID {
    return CGMainDisplayID()
}

func getCurrentDisplayMode(for displayID: CGDirectDisplayID) -> CGDisplayMode? {
    return CGDisplayCopyDisplayMode(displayID)
}

func getAvailableDisplayModes(for displayID: CGDirectDisplayID) -> [CGDisplayMode] {
  let options = [
    kCGDisplayShowDuplicateLowResolutionModes: true as CFBoolean
  ] as CFDictionary

  guard let modes = CGDisplayCopyAllDisplayModes(displayID, options) as? [CGDisplayMode] else {
        return []
    }
    return modes
}

func displayModeString(_ mode: CGDisplayMode, isCurrent: Bool) -> String {
    let modeString = "\(mode.width) x \(mode.height)"
    return isCurrent ? "\(modeString) *" : modeString
}

func listDisplayModes() {
    let displayID = getMainDisplay()
    guard let currentMode = getCurrentDisplayMode(for: displayID) else {
        print("Unable to determine current display mode.")
        return
    }

    let modes = getAvailableDisplayModes(for: displayID)
    var seenResolutions = Set<String>()

    for mode in modes {
        let key = "\(mode.width)x\(mode.height)"
        // Avoid listing duplicate resolutions
        if seenResolutions.contains(key) {
            continue
        }
        seenResolutions.insert(key)

        let isCurrent = (mode.width == currentMode.width && mode.height == currentMode.height)
        print(displayModeString(mode, isCurrent: isCurrent))
    }
}

func setDisplayMode(width: Int, height: Int) {
    let displayID = getMainDisplay()
    let modes = getAvailableDisplayModes(for: displayID)

    guard let modeToSet = modes.first(where: { $0.width == width && $0.height == height }) else {
        print("No matching display mode found for \(width)x\(height)")
        return
    }

    let config = UnsafeMutablePointer<CGDisplayConfigRef?>.allocate(capacity: 1)
    defer { config.deallocate() }

    if CGBeginDisplayConfiguration(config) != .success {
        print("Failed to begin display configuration")
        return
    }

    if CGConfigureDisplayWithDisplayMode(config.pointee, displayID, modeToSet, nil) != .success {
        print("Failed to configure display mode")
        return
    }

    if CGCompleteDisplayConfiguration(config.pointee, .permanently) != .success {
        print("Failed to complete display configuration")
        return
    }

    print("Display resolution changed to \(width) x \(height)")
}

let args = CommandLine.arguments

switch args.count {
case 1:
    listDisplayModes()
case 3:
    if let width = Int(args[1]), let height = Int(args[2]) {
        setDisplayMode(width: width, height: height)
    } else {
        print("Usage: screen-size [width height]")
    }
default:
    print("Usage: screen-size [width height]")
}