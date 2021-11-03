tell application "Safari"
	activate
	tell application "System Events"
		tell process "Safari"
			keystroke "N" using {shift down, command down}
		end tell
	end tell
end tell
