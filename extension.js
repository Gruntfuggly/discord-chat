/* jshint esversion:6 */

var discord = require( 'discord.js' );
var strftime = require( 'strftime' );
var vscode = require( 'vscode' );

var lastRead = require( './lastRead' );
var treeView = require( './dataProvider' );

var outputChannels = {};
var currentChannel;

function activate( context )
{
    const client = new discord.Client();

    var provider = new treeView.DiscordChatDataProvider( context );
    var generalOutputChannel = vscode.window.createOutputChannel( 'discord-chat' );

    lastRead.initialize( generalOutputChannel );

    function channelName( channel )
    {
        var name = 'discord-chat.';
        if( channel.guild )
        {
            name += channel.guild.name;
        }
        else
        {
            name += "dm";
        }
        name += '.' + channel.name;

        return name;
    }

    function formatMessage( message )
    {
        var compact = vscode.workspace.getConfiguration( 'discord-chat' ).compactView;

        function separator()
        {
            return compact === true ? ": " : ":\n ";
        }

        function content( text )
        {
            return text.split( '\n' ).join( compact ? "\n" : "\n " );
        }

        var entries = [];

        var timestamp = strftime( "%a %H:%M:%S", new Date( message.createdAt ) );

        if( message.type == "GUILD_MEMBER_JOIN" )
        {
            entries.push( timestamp + " @" + message.author.username + " joined" );
        }
        else if( message.cleanContent )
        {
            entries.push( timestamp + " @" + message.author.username + separator() + content( message.cleanContent ) );
        }
        else if( message.content )
        {
            entries.push( timestamp + " @" + message.author.username + separator() + content( message.content ) );
        }

        message.attachments.map( function( attachment )
        {
            entries.push( timestamp + " @" + message.author.username + " attached " + attachment.url );
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

    function populateChannel( outputChannelName )
    {
        var entries = [];
        var options = {
            limit: vscode.workspace.getConfiguration( 'discord-chat' ).history,
        };

        if( outputChannels[ outputChannelName ].lastMessage )
        {
            options.after = outputChannels[ outputChannelName ].lastMessage.id;
        }

        outputChannels[ outputChannelName ].discordChannel.fetchMessages( options ).then( function( messages )
        {
            if( messages.size > 0 )
            {
                outputChannels[ outputChannelName ].lastMessage = messages.values().next().value;
            }

            messages.map( function( message )
            {
                entries = entries.concat( formatMessage( message ) );
                if( vscode.workspace.getConfiguration( 'discord-chat' ).compactView !== true )
                {
                    entries.push( "" );
                }
            } );

            entries.reverse().map( function( entry )
            {
                outputChannels[ outputChannelName ].outputChannel.appendLine( entry );
            } );

            provider.markRead( outputChannels[ outputChannelName ].discordChannel );
        } );
    }

    function refresh()
    {
        provider.populate( client.channels );
        provider.refresh();
    }

    function register()
    {
        updateSelectionState();

        var discordChatExplorerView = vscode.window.createTreeView( 'discord-chat-view-explorer', { treeDataProvider: provider } );
        var discordChatView = vscode.window.createTreeView( 'discord-chat-view', { treeDataProvider: provider } );

        context.subscriptions.push( vscode.commands.registerCommand( 'discord-chat.refresh', refresh ) );

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
                refresh();
            }
        } ) );

        context.subscriptions.push( vscode.window.onDidChangeActiveTextEditor( function( e )
        {
            var documents = vscode.workspace.textDocuments;

            documents.map( document =>
            {
                if( document.uri && document.uri.scheme === 'output' )
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
            var outputChannelName = channelName( channel );
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

            populateChannel( outputChannelName );
        } ) );

        context.subscriptions.push( vscode.workspace.onDidChangeConfiguration( function( e )
        {
            if( e.affectsConfiguration( 'discord-chat.showInExplorer' ) )
            {
                vscode.commands.executeCommand( 'setContext', 'discord-chat-in-explorer', vscode.workspace.getConfiguration( 'discord-chat' ).showInExplorer );
            }
            else if( e.affectsConfiguration( 'discord-chat.token' ) && client.readyAt === null )
            {
                login();
            }
            else if( e.affectsConfiguration( 'discord-chat.compactView' ) ||
                e.affectsConfiguration( 'discord-chat.history' ) )
            {
                Object.keys( outputChannels ).map( outputChannelName =>
                {
                    outputChannels[ outputChannelName ].outputChannel.clear();
                    outputChannels[ outputChannelName ].lastMessage = undefined;
                    populateChannel( outputChannelName );
                } );
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
            refresh();
        } );

        client.on( 'message', message =>
        {
            if( message.channel.type === 'text' )
            {
                var outputChannelName = channelName( message.channel );

                outputChannels[ outputChannelName ].lastMessage = message;
                if( message.channel === currentChannel )
                {
                    var outputChannel = outputChannels[ outputChannelName ].outputChannel;
                    if( outputChannel )
                    {

                        if( vscode.workspace.getConfiguration( 'discord-chat' ).compactView !== true )
                        {
                            outputChannel.appendLine( "" );
                        }

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

    return lastRead;
}

function deactivate()
{
}

exports.activate = activate;
exports.deactivate = deactivate;
