/* jshint esversion:6 */

const discord = require( 'discord.js' );
const strftime = require( 'strftime' );
const vscode = require( 'vscode' );
var treeView = require( "./dataProvider" );

var outputChannels = {};
var currentChannel;

function activate( context )
{
    const client = new discord.Client();

    var provider = new treeView.DiscordChatDataProvider( context );
    var generalOutputChannel = vscode.window.createOutputChannel( 'discord-chat' );

    function formatMessage( message )
    {
        var entries = [];

        var timestamp = strftime( "%a %H:%M:%S", new Date( message.createdAt ) );

        if( message.type == "GUILD_MEMBER_JOIN" )
        {
            entries.push( timestamp + " " + message.author.username + " joined" );
        }
        else if( message.cleanContent )
        {
            entries.push( timestamp + " " + message.author.username + ":\n " + message.cleanContent );
        }
        else if( message.content )
        {
            entries.push( timestamp + " " + message.author.username + ":\n " + message.content );
        }

        message.attachments.map( function( attachment )
        {
            entries.push( timestamp + " " + message.author.username + " attached " + attachment.url );
        } );

        return entries;
    }

    function login()
    {
        generalOutputChannel.appendLine( "Logging in..." );

        var token = vscode.workspace.getConfiguration( 'discord-chat' ).token;
        if( token )
        {
            client.login( token ).then( function()
            {
            } ).catch( function( reason )
            {
                generalOutputChannel.appendLine( reason );
            } );
        }
        else
        {
            vscode.window.showInformationMessage( "Please set discord-chat.token (see https://discordhelp.net/discord-token)" );
        }
    }

    function updateSelectionState()
    {
        vscode.commands.executeCommand( 'setContext', 'discord-channel-selected', currentChannel !== undefined );
    }

    function register()
    {
        updateSelectionState();

        var discordChatExplorerView = vscode.window.createTreeView( "discord-chat-view-explorer", { treeDataProvider: provider } );
        var discordChatView = vscode.window.createTreeView( "discord-chat-view", { treeDataProvider: provider } );

        context.subscriptions.push( vscode.commands.registerCommand( 'discord-chat.post', function()
        {
            if( currentChannel )
            {
                vscode.window.showInputBox( { prompt: "Post message to #" + currentChannel.name } ).then(
                    function( message )
                    {
                        if( message )
                        {
                            currentChannel.send( message );
                        }
                    } );
            }
            else
            {
                vscode.window.showInformationMessage( "discord-chat: Please select a channel first" );
            }
        } ) );

        context.subscriptions.push( vscode.window.onDidChangeWindowState( function( e )
        {
            if( e.focused )
            {
                provider.populate( client.channels );
                provider.refresh();
            }
        } ) );

        context.subscriptions.push( vscode.window.onDidChangeActiveTextEditor( function( e )
        {
            var documents = vscode.workspace.textDocuments;

            documents.map( document =>
            {
                if( document.uri && document.uri.scheme === "output" )
                {
                    Object.keys( outputChannels ).forEach( channelName =>
                    {
                        if( outputChannels[ channelName ].outputChannel._id === document.fileName )
                        {
                            currentChannel = outputChannels[ channelName ].discordChannel;
                            updateSelectionState();
                            var element = provider.getChannelElement( outputChannels[ channelName ].discordChannel );
                            if( discordChatExplorerView.visible === true )
                            {
                                discordChatExplorerView.reveal( element, { focus: false, select: true } );
                            }
                            if( discordChatView.visible === true )
                            {
                                discordChatView.reveal( element, { focus: false, select: true } );
                            }
                        }
                    } );
                }
            } );
        } ) );

        context.subscriptions.push( vscode.commands.registerCommand( 'discord-chat.selectServer', ( server ) =>
        {
            currentChannel = undefined;
            updateSelectionState();
        } ) );

        context.subscriptions.push( vscode.commands.registerCommand( 'discord-chat.openChannel', ( channel ) =>
        {
            var outputChannelName = 'discord-chat.' + channel.guild.name + '.' + channel.name;
            currentChannel = channel;
            updateSelectionState();

            var outputChannel = outputChannels[ outputChannelName ];
            if( !outputChannel )
            {
                outputChannel = vscode.window.createOutputChannel( outputChannelName );
                outputChannels[ outputChannelName ] = {
                    outputChannel: outputChannel,
                    discordChannel: channel
                };
                context.subscriptions.push( outputChannel );
            }
            else
            {
                outputChannel = outputChannel.outputChannel;
            }

            outputChannel.show( true );

            var entries = [];
            var options = {
                limit: vscode.workspace.getConfiguration( 'discord-chat' ).history,
            };

            if( outputChannels[ outputChannelName ].lastMessage )
            {
                options.after = outputChannels[ outputChannelName ].lastMessage.id;
            }

            channel.fetchMessages( options ).then( function( messages )
            {
                if( messages.size > 0 )
                {
                    outputChannels[ outputChannelName ].lastMessage = messages.values().next().value;
                }

                messages.map( function( message )
                {
                    entries = entries.concat( formatMessage( message ) );
                } );

                entries.reverse().map( function( entry )
                {
                    outputChannel.appendLine( entry );
                } );

                provider.markRead( channel );
            } );
        } ) );

        context.subscriptions.push( vscode.workspace.onDidChangeConfiguration( function( e )
        {
            if( e.affectsConfiguration( "discord-chat" ) )
            {
                vscode.commands.executeCommand( 'setContext', 'discord-chat-in-explorer', vscode.workspace.getConfiguration( 'discord-chat' ).showInExplorer );

                if( client.readyAt === null )
                {
                    login();
                }
            }
        } ) );

        context.subscriptions.push( generalOutputChannel );

        vscode.commands.executeCommand( 'setContext', 'discord-chat-in-explorer', vscode.workspace.getConfiguration( 'discord-chat' ).showInExplorer );

        client.on( 'error', error =>
        {
            generalOutputChannel.appendLine( "error: " + JSON.stringify( error ) );
        } );
        client.on( 'warn', warning =>
        {
            generalOutputChannel.appendLine( "warning: " + JSON.stringify( warning ) );
        } );
        client.on( 'debug', message =>
        {
            generalOutputChannel.appendLine( "debug: " + JSON.stringify( message ) );
        } );

        client.on( 'ready', () =>
        {
            generalOutputChannel.appendLine( `Logged in as ${client.user.tag}!` );
            provider.populate( client.channels );
            provider.refresh();
        } );

        client.on( 'message', message =>
        {
            if( message.channel.type === "text" )
            {
                if( message.channel === currentChannel )
                {
                    var outputChannelName = 'discord-chat.' + message.channel.guild.name + '.' + message.channel.name;
                    var outputChannel = outputChannels[ outputChannelName ].outputChannel;
                    if( outputChannel )
                    {
                        formatMessage( message ).map( entry =>
                        {
                            outputChannel.appendLine( entry )
                        } );
                    }
                    provider.markRead( message.channel );
                }
                else
                {
                    provider.update( message );
                }
            }
        } );

        login();
    }

    register();
}

function deactivate()
{
}

exports.activate = activate;
exports.deactivate = deactivate;
