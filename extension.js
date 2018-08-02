/* jshint esversion:6 */

var discord = require( 'discord.js' );
var fs = require( 'fs' );
var path = require( 'path' );
var strftime = require( 'strftime' );
var vscode = require( 'vscode' );

var storage = require( './storage' );
var treeView = require( './dataProvider' );
var utils = require( './utils' );

var outputChannels = {};
var mutedChannels = {};
var currentServer;
var currentChannel;
var decorations = [];
var highlightTimeout;

function activate( context )
{
    const client = new discord.Client();

    var provider = new treeView.DiscordChatDataProvider( context );
    var generalOutputChannel = vscode.window.createOutputChannel( 'discord-chat' );

    storage.initialize( generalOutputChannel );

    function getDecoration( tag )
    {
        return vscode.window.createTextEditorDecorationType( {
            light: { color: utils.toDarkColour( tag ) },
            dark: { color: utils.toLightColour( tag ) },
        } );
    }

    function formatMessage( message, short )
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

        function isCode( text )
        {
            var codeRegex = new RegExp( "```(.+)\n((.*\n)*)```" );
            var result = codeRegex.exec( text );
            return result;
        }

        var entries = [];

        var timestamp = strftime( short ? "%H:%M" : "%a %H:%M:%S", new Date( message.createdAt ) );

        var header =
            timestamp +
            ( short ? ( " [" + utils.toServerName( message.channel ) + "/" + utils.toChannelName( message.channel ) + "]" ) : "" ) +
            " @" + message.author.username;

        if( message.author )
        {
            var code = isCode( message.content );

            if( message.type == "GUILD_MEMBER_JOIN" )
            {
                entries.push( header + " joined" );
            }
            else if( code )
            {
                entries.push( header + " posted some " + code[ 1 ] + " code:\n" + code[ 2 ] );
            }
            else if( message.cleanContent )
            {
                entries.push( header + separator() + content( message.cleanContent ) );
            }
            else if( message.content )
            {
                entries.push( header + separator() + content( message.content ) );
            }
            else if( message.embeds.length > 0 )
            {
                message.embeds.map( function( embed )
                {
                    if( embed.image )
                    {
                        entries.push( header + " embedded image " + embed.image.url + " (" + embed.description + ")" );
                    }
                    if( embed.video )
                    {
                        entries.push( header + " embedded video " + embed.video.url + " (" + embed.description + ")" );
                    }
                } );
            }

            if( message.attachments )
            {
                message.attachments.map( function( attachment )
                {
                    entries.push( header + " attached " + attachment.url );
                } );
            }
        }

        return entries;
    }

    function promptForToken()
    {
        vscode.window.showInformationMessage(
            "Please set your discord-chat.token",
            "Help",
            "Enter token",
            "OK" ).then( button =>
            {
                if( button === "Help" )
                {
                    vscode.commands.executeCommand( 'vscode.open', vscode.Uri.parse( "https://discordhelp.net/discord-token" ) );
                    promptForToken();
                }
                else if( button === "Enter token" )
                {
                    vscode.window.showInputBox( { prompt: "Token:" } ).then( function( token )
                    {
                        if( token )
                        {
                            vscode.workspace.getConfiguration( 'discord-chat' ).update( 'token', token, true );
                        }
                        else
                        {
                            promptForToken();
                        }
                    } );
                }
            } );
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
            promptForToken();
        }
    }

    function updateSelectionState()
    {
        vscode.commands.executeCommand( 'setContext', 'discord-channel-selected', currentChannel !== undefined );
        vscode.commands.executeCommand( 'setContext', 'discord-server-selected', currentServer !== undefined && currentChannel === undefined );
        if( currentServer && currentChannel === undefined )
        {
            var serverElement = provider.getServerElement( currentServer );
            vscode.commands.executeCommand( 'setContext', 'discord-server-has-unread', serverElement && serverElement.unreadCount > 0 );
        }
        else
        {
            vscode.commands.executeCommand( 'setContext', 'discord-server-has-unread', false );
        }
        var canMute = false;
        var canUnmute = false;
        if( currentChannel )
        {
            canUnmute = storage.getChannelMuted( currentChannel ) === true;
            canMute = !canUnmute;
        }
        else if( currentServer )
        {
            canUnmute = storage.getServerMuted( currentServer ) === true;
            canMute = !canUnmute;
        }
        vscode.commands.executeCommand( 'setContext', 'discord-can-mute', canMute );
        vscode.commands.executeCommand( 'setContext', 'discord-can-unmute', canUnmute );
    }

    function populateChannel( channel, done )
    {
        var entries = [];
        var options = {
            limit: vscode.workspace.getConfiguration( 'discord-chat' ).history,
        };

        if( outputChannels[ channel.id.toString() ].lastMessage )
        {
            options.after = outputChannels[ channel.id.toString() ].lastMessage.id;
        }

        if( storage.getChannelMuted( channel ) !== true )
        {
            channel.fetchMessages( options ).then( function( messages )
            {
                if( messages.size > 0 )
                {
                    outputChannels[ channel.id.toString() ].lastMessage = messages.values().next().value;
                }

                var storedDate = storage.getLastRead( channel );
                var channelLastRead = new Date( storedDate ? storedDate : 0 );
                var lineAdded = false;

                messages.map( function( message )
                {
                    if( lineAdded === false && message.createdAt < channelLastRead )
                    {
                        entries.push( "------------" );
                        lineAdded = true;
                    }

                    entries = entries.concat( formatMessage( message ) );

                    if( vscode.workspace.getConfiguration( 'discord-chat' ).compactView !== true )
                    {
                        entries.push( "" );
                    }
                } );

                entries.reverse().map( function( entry )
                {
                    outputChannels[ channel.id.toString() ].outputChannel.appendLine( entry );
                } );

                provider.markChannelRead( channel );

                done();
            } ).catch( function( e )
            {
                console.log( e );
            } );
        }
    }

    function refresh()
    {
        var pending = client.guilds ? client.guilds.size : 0;
        var icons = {};

        function checkFinished()
        {
            --pending;
            if( pending === 0 )
            {
                provider.setIcons( icons );
                provider.populate( client.user, client.channels );
                provider.refresh();
            }
        }

        if( client.readyAt === null )
        {
            login();
        }
        else
        {
            var storagePath = context.storagePath;
            if( context.storagePath && !fs.existsSync( context.storagePath ) )
            {
                fs.mkdirSync( context.storagePath );
            }
            if( storagePath && client.guilds )
            {
                client.guilds.map( guild =>
                {
                    if( guild.iconURL )
                    {
                        var filename = path.join( storagePath, "server_" + guild.id.toString() + utils.urlExt( guild.iconURL ) );
                        icons[ guild.id.toString() ] = filename;
                        utils.fetchIcon( guild.iconURL, filename, checkFinished );
                    }
                    else
                    {
                        checkFinished();
                    }
                } );
            }
            else
            {
                provider.populate( client.user, client.channels );
                provider.refresh();
            }
        }
    }

    function triggerHighlight()
    {
        clearTimeout( highlightTimeout );
        highlightTimeout = setTimeout( highlightUsers, vscode.workspace.getConfiguration( 'discord-chat' ).get( 'highlightDelay', 500 ) );
    }

    function highlightUsers()
    {
        function escapeRegExp( str )
        {
            return str.replace( /[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&" );
        }

        var visibleEditors = vscode.window.visibleTextEditors;

        visibleEditors.map( editor =>
        {
            if( editor.document && editor.document.uri && editor.document.uri.scheme === 'output' )
            {
                var highlights = {};

                const text = editor.document.getText();
                var userList = [];
                if( client.users.size )
                {
                    client.users.map( user => { userList.push( escapeRegExp( "@" + user.username ) ); } );
                    var regex = new RegExp( "(" + userList.join( "|" ) + ")", 'g' );
                    let match;
                    while( ( match = regex.exec( text ) ) !== null )
                    {
                        const tag = match[ match.length - 1 ];
                        const startPos = editor.document.positionAt( match.index );
                        const endPos = editor.document.positionAt( match.index + match[ 0 ].length );
                        const decoration = { range: new vscode.Range( startPos, endPos ) };
                        if( highlights[ tag ] === undefined )
                        {
                            highlights[ tag ] = [];
                        }
                        highlights[ tag ].push( decoration );
                    }
                    decorations.forEach( decoration =>
                    {
                        decoration.dispose();
                    } );
                    Object.keys( highlights ).forEach( tag =>
                    {
                        var decoration = getDecoration( tag );
                        decorations.push( decoration );
                        editor.setDecorations( decoration, highlights[ tag ] );
                    } );
                }
            }
        } );
    }

    function updateCurrentChannel( message )
    {
        outputChannels[ message.channel.id.toString() ].lastMessage = message;
        var outputChannel = outputChannels[ message.channel.id.toString() ].outputChannel;
        if( outputChannel )
        {
            if( vscode.workspace.getConfiguration( 'discord-chat' ).compactView !== true )
            {
                outputChannel.appendLine( "" );
            }
            formatMessage( message ).map( entry =>
            {
                outputChannel.appendLine( entry );
            } );
            triggerHighlight();
        }
        provider.markChannelRead( message.channel );
    }

    function register()
    {
        function revealChannel( element, focus, select )
        {
            if( discordChatExplorerView.visible === true )
            {
                discordChatExplorerView.reveal( element, { focus: focus, select: select } );
            }
            if( discordChatView.visible === true )
            {
                discordChatView.reveal( element, { focus: focus, select: select } );
            }
        }

        function updateChannel( message )
        {
            function showNotification()
            {
                var notify = vscode.workspace.getConfiguration( 'discord-chat' ).notify;
                if( notify === "always" ||
                    ( notify == "whenHidden" &&
                        ( discordChatExplorerView.visible === false && discordChatView.visible === false ) ) )
                {
                    vscode.window.showInformationMessage( formatMessage( message, true ).join() );
                }
            }

            provider.update( message );

            showNotification();
        }

        updateSelectionState();

        var discordChatExplorerView = vscode.window.createTreeView( 'discord-chat-view-explorer', { treeDataProvider: provider } );
        var discordChatView = vscode.window.createTreeView( 'discord-chat-view', { treeDataProvider: provider } );

        context.subscriptions.push( vscode.commands.registerCommand( 'discord-chat.refresh', refresh ) );
        context.subscriptions.push( vscode.commands.registerCommand( 'discord-chat.markAllRead', function()
        {
            provider.markAllRead();
        } ) );

        context.subscriptions.push( vscode.commands.registerCommand( 'discord-chat.markServerRead', function()
        {
            if( currentServer )
            {
                provider.markServerRead( currentServer );
                updateSelectionState();
            }
        } ) );

        context.subscriptions.push( vscode.commands.registerCommand( 'discord-chat.createChannel', function()
        {
            if( currentServer )
            {
                vscode.window.showInputBox( { prompt: "Channel name:" } ).then(
                    function( name )
                    {
                        if( name )
                        {
                            currentServer.createChannel( name, 'text' ).then( function( channel )
                            {
                                refresh();
                                var element = provider.getChannelElement( channel );
                                revealChannel( element, true, true );
                            }
                            ).catch(
                                e =>
                                {
                                    vscode.window.showErrorMessage( e.message );
                                }
                            );
                        }
                    } );
            }
            else
            {
                vscode.window.showInformationMessage( "discord-chat: Please select a server first" );
            }
        } ) );

        context.subscriptions.push( vscode.commands.registerCommand( 'discord-chat.deleteChannel', function()
        {
            if( currentChannel )
            {
                vscode.window.showInformationMessage( "discord-chat: Are you sure?", "Yes", "No" ).then( response =>
                {
                    if( response === "Yes" )
                    {
                        currentChannel.delete().then( function()
                        {
                            outputChannels[ currentChannel.id.toString() ].outputChannel.dispose();
                            refresh();
                        }
                        ).catch(
                            e =>
                            {
                                console.log( e.message );
                                vscode.window.showErrorMessage( "Failed to delete channel" );
                            }
                        );
                    }
                } );
            }
            else
            {
                vscode.window.showInformationMessage( "discord-chat: Please select a channel first" );
            }
        } ) );

        context.subscriptions.push( vscode.commands.registerCommand( 'discord-chat.leaveServer', function()
        {
            if( currentServer )
            {
                vscode.window.showInformationMessage( "discord-chat: Are you sure?", "Yes", "No" ).then( response =>
                {
                    if( response === "Yes" )
                    {
                        currentServer.leave().then( function()
                        {
                            refresh();
                        }
                        ).catch(
                            e =>
                            {
                                console.log( e.message );
                                vscode.window.showErrorMessage( "Failed to leave server" );
                            }
                        );
                    }
                } );
            }
            else
            {
                vscode.window.showInformationMessage( "discord-chat: Please select a server first" );
            }
        } ) );

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

                            if( currentChannel.type === "dm" || currentChannel.type === "group" )
                            {
                                populateChannel( currentChannel,
                                    function()
                                    {
                                        provider.markChannelRead( currentChannel );
                                    } );
                            }
                        }
                    } );
            }
            else
            {
                vscode.window.showInformationMessage( "discord-chat: Please select a channel first" );
            }
        } ) );

        context.subscriptions.push( vscode.commands.registerCommand( 'discord-chat.postSelection', function()
        {
            var editor = vscode.window.activeTextEditor;

            if( currentChannel && editor && editor.document )
            {
                if( editor.selection && editor.selection.start != editor.selection.end )
                {
                    var document = editor.document;
                    var selection = document.getText().substring( document.offsetAt( editor.selection.start ), document.offsetAt( editor.selection.end ) );
                    var language = document.languageId;
                    currentChannel.send( selection, { code: language } );
                }
                else
                {
                    vscode.window.showInformationMessage( "discord-chat: nothing selected?" );
                }
            }
            else
            {
                vscode.window.showInformationMessage( "discord-chat: Please select a channel first" );
            }
        } ) );

        context.subscriptions.push( vscode.commands.registerCommand( 'discord-chat.mute', function()
        {
            if( currentChannel )
            {
                if( currentChannel.type === 'text' )
                {
                    provider.setChannelMuted( currentChannel, true );
                }
                else
                {
                    vscode.window.showInformationMessage( "discord-chat: direct message channels can't be muted" );
                }
            }
            else if( currentServer )
            {
                provider.setServerMuted( currentServer, true );
            }

            updateSelectionState()
        } ) );

        context.subscriptions.push( vscode.commands.registerCommand( 'discord-chat.unmute', function()
        {
            if( currentChannel )
            {
                provider.setChannelMuted( currentChannel, undefined );
            }
            else if( currentServer )
            {
                provider.setServerMuted( currentServer, undefined );
            }

            updateSelectionState()
        } ) );

        context.subscriptions.push( vscode.commands.registerCommand( 'discord-chat.openDebugConsole', function()
        {
            generalOutputChannel.show();
        } ) );

        context.subscriptions.push( vscode.commands.registerCommand( 'discord-chat.selectServer', ( server ) =>
        {
            currentServer = server;
            currentChannel = undefined;
            updateSelectionState();
        } ) );

        context.subscriptions.push( vscode.commands.registerCommand( 'discord-chat.openChannel', ( channel ) =>
        {
            currentServer = channel.guild;
            currentChannel = channel;
            updateSelectionState();

            var outputChannel = outputChannels[ channel.id.toString() ];
            if( !outputChannel )
            {
                outputChannel = vscode.window.createOutputChannel( utils.toOutputChannelName( channel ) + "." + channel.id.toString() );
                outputChannels[ channel.id.toString() ] = {
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

            populateChannel( channel, triggerHighlight );
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
                    currentServer = undefined;
                    currentChannel = undefined;

                    Object.keys( outputChannels ).forEach( channelName =>
                    {
                        if( outputChannels[ channelName ].outputChannel._id === document.fileName )
                        {
                            currentChannel = outputChannels[ channelName ].discordChannel;
                            currentServer = currentChannel.guild;

                            updateSelectionState();
                            var element = provider.getChannelElement( outputChannels[ channelName ].discordChannel );
                            revealChannel( element, true, true );

                            triggerHighlight();
                        }
                    } );
                }
            } );
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
                    populateChannel( outputChannels[ outputChannelName ].discordChannel, triggerHighlight );
                } );
            }
            else if( e.affectsConfiguration( 'discord-chat.useIcons' ) )
            {
                refresh();
            }
        } ) );

        context.subscriptions.push( generalOutputChannel );

        vscode.commands.executeCommand( 'setContext', 'discord-chat-in-explorer', vscode.workspace.getConfiguration( 'discord-chat' ).showInExplorer );

        client.on( 'error', error =>
        {
            generalOutputChannel.appendLine( "error: " + error.message );
        } );
        client.on( 'warn', warning =>
        {
            generalOutputChannel.appendLine( "warning: " + warning );
        } );
        client.on( 'debug', message =>
        {
            generalOutputChannel.appendLine( "debug: " + message );
        } );

        client.on( 'ready', () =>
        {
            generalOutputChannel.appendLine( `Logged in as ${client.user.tag}!` );
            refresh();
        } );

        client.on( 'message', message =>
        {
            if( utils.isReadableChannel( client.user, message.channel ) )
            {
                if( storage.isChannelMuted( message.channel ) !== true )
                {
                    var outputChannelName = utils.toOutputChannelName( message.channel );

                    generalOutputChannel.appendLine( "Received message on " + outputChannelName );

                    if( outputChannelName )
                    {
                        if( message.channel && message.channel === currentChannel )
                        {
                            updateCurrentChannel( message );
                        }
                        else
                        {
                            updateChannel( message );
                            updateSelectionState();
                        }
                    }
                }
            }
        } );

        login();
    }

    register();

    return storage;
}

function deactivate()
{
}

exports.activate = activate;
exports.deactivate = deactivate;
