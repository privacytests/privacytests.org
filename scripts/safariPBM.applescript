on run argv
tell application (item 1 of argv)
	activate
	tell application "System Events"
		tell process (item 1 of argv)
			keystroke "W" using {option down, command down}
			keystroke "N" using {shift down, command down}
		end tell
	end tell
end tell
end run
