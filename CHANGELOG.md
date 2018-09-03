# v0.1.30 - 2018-09-03
- add reset sync command
- add close channel command
- trigger highlight correctly when updating DM or group channels
- log errors to console.error
- make debug logging configurable

# v0.1.29 - 2018-08-22
- update discord when channels are read

# v0.1.28 - 2018-08-22
- fix #2: Update selected server when expanding/collapsing tree elements
- keep explorer view and dedicated view synchronised

# v0.1.27 - 2018-08-22
- fix direct messages when user has no avatar

# v0.1.26 - 2018-08-21
- fix #1: show the date instead of day name for messages over a week old
- improve sync logging

# v0.1.25 - 2018-08-21
- allow hiding of muted servers and/or channels

# v0.1.24 - 2018-08-10
- make syncing work

# v0.1.23 - 2018-08-07
- only attempt sync if configured
- fix direct messages collapsing when marked as read

# v0.1.22 - 2018-08-07
- add initial support for syncing of muted servers, channels and last read time

# v0.1.21 - 2018-08-06
- handle empty dm groups
- remove output channels when leaving server
- refresh dm channels after posting
- refresh buttons when message is received
- add leave server command
- fix marking server read
- fix some javascript warnings
- don't update message counts when channels are muted
- trigger highlight on config change

# v0.1.20 - 2018-07-27
- add support for posting selected text from documents

# v0.1.19 - 2018-07-26
- set mute state at startup
- use "(mute)" instead of unicode

# v0.1.18 - 2018-07-26
- add mute/unmute button to tree
- improve token entry process

# v0.1.17 - 2018-07-25
- fix mark server read

# v0.1.16 - 2018-07-25
- use better format for notifications
- fix mute channel bug

# v0.1.15 - 2018-07-25
- add support for marking selected server as read

# v0.1.14 - 2018-07-25
- add support for locally muting servers and channels

# v0.1.13 - 2018-07-24
- show avatars in tree for direct messages
- several smaller fixes
- add partial support for showing embeds

# v0.1.12 - 2018-07-24
- fix tree element ids
- escape user names for highlighting
- handle view channel permissions (only show viewable channels)

# v0.1.11 - 2018-07-24
- show debug channel when clicking '...'
- retry login if connection has failed
- add server icons (can be disabled via configuration)
- use a different icon for direct messages
- fix direct message channel name
- improve robustness

# v0.1.10 - 2018-07-22
- add support for creating and deleting channels

# v0.1.9 - 2018-07-21
- show notifications for other channels regardless of focused window

# v0.1.8 - 2018-07-20
- add support for notifications

# v0.1.7 - 2018-07-19
- add screenshot to README.md

# v0.1.6 - 2018-07-19
- add support for colouring user names

# v0.1.5 - 2018-07-19
- add support for direct messages
- update extension icon
- add refresh button

# v0.1.4 - 2018-07-18
- add compact view option

# v0.1.3 - 2018-07-18
- sync unread counts between windows

# v0.1.2 - 2018-07-18
- persist unread counts
- add status bar indicator for unread messages
- simplify total counting
- only show post icon when channel is selected
- keep selected channel in sync
- change fetching message to ...
- store read times in globalState
- fetch messages based on last fetched

# v0.1.1 - 2018-07-17
- fix README.md again

# v0.1.0 - 2018-07-17
- fix README.md

# v0.0.1 - 2018-07-17
- first version
