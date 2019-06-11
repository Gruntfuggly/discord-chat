# Discord Chat

---

**Important Note: It seems that the way this extension works is not entirely within Discord's terms of service.**

 See [here](https://support.discordapp.com/hc/en-us/articles/115002192352-Automated-user-accounts-self-bots-).

Please note:

- it does not automatically respond to any messages
- it does not collect information about invites sent in chat channels

**However, by using it, you may run the risk of having your discord account terminated.**

---

If you're happy to proceed...

A [Discord](https://discordapp.com/) chat client for vscode.

After installing, go to your settings and set `discord-chat.token` to your API token. See [here](https://discordhelp.net/discord-token) for one way of finding your token. There are other ways too.

*NOTE: Keep your token to yourself!*

A tree view will show available servers and channels. Click on a channel to open the channel in the output panel. Click the post icon in the tree view or use the `discord-chat: Post` command to send a message to the currently selected channel.

<img src="https://raw.githubusercontent.com/Gruntfuggly/discord-chat/master/resources/screenshot.png">

### Image Preview

Chats are shown in the output view which means that attached images are shown as links. If you install the excellent [Image Preview](https://marketplace.visualstudio.com/items?itemName=kisstkondoros.vscode-gutter-preview) by Kiss Tamás, hovering the mouse over the links will show the image in a pop up.

### Syncing

If you use vscode on multiple machines, you may want to sync your muted servers, channels and last read times. To enable this, use github to generate a personal access token (with gist scope) and update `discord-chat.syncToken`. The first time a sync is attempted, a gist will be created and the ID will be stored in your settings in `discord-chat.syncGistId`. To sync other instances of vscode, you'll need to copy the `discord-chat.syncToken` and `discord-chat.syncGistId` settings.

### Commands

- `discord-chat: Post` - send a message to the selected channel
- `discord-chat: Post Selection` - send the currently selected text to the currently selected channel
- `discord-chat: Edit Post` - allows a previously posted message to be changed
- `discord-chat: Create Channel` - create a new channel on the selected server
- `discord-chat: Delete Channel` - delete the currently selected channel
- `discord-chat: Mark All Read` - reset unread count on all channels on all servers
- `discord-chat: Mark All Channels on Server as Read` - reset unread count on all channels on the currently selected server
- `discord-chat: Refresh` - repopulate the channel list
- `discord-chat: Mute` - mute the currently selected server or channel
- `discord-chat: Unmute` - unmute a previously muted server or channel
- `discord-chat: Reset Sync` - clear sync data
- `discord-chat: Close Channel` - delete the output window for the currently selected channel
- `discord-chat: Show Unread Only` - only show servers and channels with unread content
- `discord-chat: Show All` - show all servers and channels

*Note: To prevent a chat from auto hiding while you are reading it, click in the window.*

### Notifications

Notifications are generated if a message arrives from a channel other that the currently selected channel. By default these these will only be shown if the channel tree is hidden (or collapsed). See *Configuration* for other settings.

### Muting

A muted channel or server will not generate notifications, update it's unread count, or show new messages as they arrive. However, If a muted channel is opened from the tree, the latest messages will be fetched. *Note: This form of muting is local to vscode and does not affect any muted state of discord itself.*

## TODO

- [ ] somehow show avatars
- [ ] support categories

## Installing

You can install the latest version of the extension via the Visual Studio Marketplace [here](https://marketplace.visualstudio.com/items?itemName=Gruntfuggly.discord-chat).

### Source Code

The source code is available on GitHub [here](https://github.com/Gruntfuggly/discord-chat).

## Configuration

The extension can be customised as follows:

| Setting | Default | Description |
|:-|:-|:-|
| discord-chat.token | | You need to set this to authenticate with Discord |
| discord-chat.compactView | false | Set this to true to put the date, time, name and first line of the message on one line |
| discord-chat.notify | whenHidden | Can also be set to "always" or "never" |
| discord-chat.history | 10 | The number of previous messages to fetch when opening a channel |
| discord-chat.showInExplorer | true | Set this to false if you would rather only see the channel list in a dedicated view in the activity bar |
| discord-chat.hideMutedServers | false | Set this to true to hide muted servers in the tree |
| discord-chat.hideMutedChannels | false | Set this to true to hide muted channels in the tree |
| discord-chat.syncToken || A github token to allow syncing of muted servers, channels and last read times |
| discord-chat.syncGistId || A github gist ID to allow syncing of muted servers, channels and last read times |
| discord-chat.autoOpen | false | Automatically show a channel when a message is received |
| discord-chat.autoClose | 0 | Automatically hide a channel after this many seconds of inactivity (Set to 0 to disable) |
| discord-chat.fetchUnreadMessages | true | Unread message counts are generated at startup. Set this to false to skip |
| discord-chat.syncEnabled | true | Set this to false to turn off syncing |

## Known Issues

This extension only provides features that I currently use or know about. If you feel there is something broken or missing, please add a bug report or feature request in the GitHub repository, [here](https://github.com/Gruntfuggly/discord-chat).

### Credits

Container icon from [iconscout](https://iconscout.com/icon/discord-3).

Extension, Group and Read/Unread icons made by <a href="http://www.freepik.com" title="Freepik">Freepik</a> from <a href="https://www.flaticon.com/" title="Flaticon">www.flaticon.com</a> is licensed by <a href="http://creativecommons.org/licenses/by/3.0/" title="Creative Commons BY 3.0" target="_blank">CC 3.0 BY</a>

Unmute and Post icon from made by <a href="https://www.flaticon.com/authors/dave-gandy" title="Dave Gandy">Dave Gandy</a> from <a href="https://www.flaticon.com/" title="Flaticon">www.flaticon.com</a> is licensed by <a href="http://creativecommons.org/licenses/by/3.0/" title="Creative Commons BY 3.0" target="_blank">CC 3.0 BY</a>

Direct message icon made by <a href="https://www.flaticon.com/authors/yannick" title="Yannick">Yannick</a> from <a href="https://www.flaticon.com/" title="Flaticon">www.flaticon.com</a> is licensed by <a href="http://creativecommons.org/licenses/by/3.0/" title="Creative Commons BY 3.0" target="_blank">CC 3.0 BY</a>

Tick icon made by <a href="https://www.flaticon.com/authors/eleonor-wang" title="Eleonor Wang">Eleonor Wang</a> from <a href="https://www.flaticon.com/" title="Flaticon">www.flaticon.com</a> is licensed by <a href="http://creativecommons.org/licenses/by/3.0/" title="Creative Commons BY 3.0" target="_blank">CC 3.0 BY</a>

Mute icon made by <a href="https://www.flaticon.com/authors/pixel-perfect" title="Pixel perfect">Pixel perfect</a> from <a href="https://www.flaticon.com/" title="Flaticon">www.flaticon.com</a> is licensed by <a href="http://creativecommons.org/licenses/by/3.0/" title="Creative Commons BY 3.0" target="_blank">CC 3.0 BY</a>

<div>Icons made by <a href="http://www.freepik.com" title="Freepik">Freepik</a> from <a href="https://www.flaticon.com/" title="Flaticon">www.flaticon.com</a> is licensed by <a href="http://creativecommons.org/licenses/by/3.0/" title="Creative Commons BY 3.0" target="_blank">CC 3.0 BY</a></div>
