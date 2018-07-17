# Discord Chat

A very basic chat client for [Discord](https://discordapp.com/).

A tree view will show available servers and channels. Click on a channel to open the channel in the output panel. Click the post icon in the tree view or use the `discord-char: Post` command to send a message to the currently selected channel.

<!-- <img src="https://raw.githubusercontent.com/Gruntfuggly/discord-chat/master/resources/screenshot.png"> -->

## TODO

- [ ] somehow colour names in the output panel
- [ ] somehow show avatars
- [ ] show tree icons for servers and channels
- [ ] persist unread message counts
- [ ] create a panel icon
- [ ] allow notifications
- [ ] allow panel format to be configurable
- [ ] add button for posting
- [ ] ensure output panel is visible (visible editors)

## Installing

You can install the latest version of the extension via the Visual Studio Marketplace [here](https://marketplace.visualstudio.com/items?itemName=Gruntfuggly.discord-chat).

Alternatively, open Visual Studio code, press `Ctrl+P` or `Cmd+P` and type:

    > ext install discord-chat

### Source Code

The source code is available on GitHub [here](https://github.com/Gruntfuggly/discord-chat).

## Configuration

The extension can be customised as follows:

| Setting | Default | Description |
|---------|---------|-------------|
| discord-chat.token | | You need to set this to autheticate with Discord. |
| discord-chat.history | 10 | The number of previous messages to fetch when opening a channel |
| discord-chat.showInExplorer | true | Set this to false if you would rather only see the channel list in a dedicated view in the activity bar |

## Known Issues

### Credits

