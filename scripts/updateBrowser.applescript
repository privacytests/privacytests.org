on run argv
  tell application "System Events" to tell process (item 1 of argv)
      click menu item (item 2 of argv) of menu 1 of menu bar item (item 1 of argv) of menu bar 1
  end tell
end run
