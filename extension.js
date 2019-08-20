/* jshint esversion:6 */

var discord = require( 'discord.js' );
var fs = require( 'fs' );
var path = require( 'path' );
var vscode = require( 'vscode' );
var strftime = require( 'strftime' );

var storage = require( './storage' );
var treeView = require( './dataProvider' );
var utils = require( './utils' );
var chats = require( './chats' );
var streams = require( './streams' );

var channelMessages = {};

var discordChatExplorerView;
var discordChatView;

var selectionChangedTimeout;
var decorateTimeout;

var aborted = false;

function activate( context )
{
    const client = new discord.Client();

    var provider = new treeView.DiscordChatDataProvider( context );
    var generalOutputChannel = vscode.window.createOutputChannel( 'Discord Chat' );

    utils.initialize( generalOutputChannel );
    storage.initialize( context.globalState );
    streams.initialize( client );

    function trace( text )
    {
        console.log( "discord-chat.trace: " + text );
    }

    function selectedChannel()
    {
        trace( "selectedChannel" );
        var result;
        if( discordChatExplorerView && discordChatExplorerView.visible === true )
        {
            discordChatExplorerView.selection.map( function( element )
            {
                result = element.channel;
            } );
        }
        if( discordChatView && discordChatView.visible === true )
        {
            discordChatView.selection.map( function( element )
            {
                result = element.channel;
            } );
        }
        return result;
    }

    function selectedServer()
    {
        trace( "selectedServer" );
        var result;
        if( discordChatExplorerView && discordChatExplorerView.visible === true )
        {
            discordChatExplorerView.selection.map( function( element )
            {
                result = element.server;
            } );
        }
        if( discordChatView && discordChatView.visible === true )
        {
            discordChatView.selection.map( function( element )
            {
                result = element.server;
            } );
        }
        return result;
    }

    function promptForToken()
    {
        trace( "promptForToken" );
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
        trace( "login" );
        utils.log( "Logging in..." );

        var token = vscode.workspace.getConfiguration( 'discord-chat' ).get( 'token' );
        if( token )
        {
            client.login( token ).then( function()
            {
            } ).catch( function( reason )
            {
                utils.log( reason );
            } );
        }
        else
        {
            promptForToken();
        }
    }

    function updateToolbarButtons()
    {
        trace( "updateToolbarButtons" );
        var sc = selectedChannel();
        var ss = selectedServer();

        vscode.commands.executeCommand( 'setContext', 'discord-channel-selected', sc !== undefined );
        vscode.commands.executeCommand( 'setContext', 'discord-server-selected', ss !== undefined && sc === undefined );

        if( ss && sc === undefined )
        {
            var serverElement = provider.getServerElement( ss );
            vscode.commands.executeCommand( 'setContext', 'discord-server-has-unread', serverElement && serverElement.unreadCount > 0 );
            vscode.commands.executeCommand( 'setContext', 'discord-channel-has-unread', false );
        }
        else
        {
            var channelElement = provider.getChannelElement( sc );
            vscode.commands.executeCommand( 'setContext', 'discord-channel-has-unread', channelElement && channelElement.unreadCount > 0 );
            vscode.commands.executeCommand( 'setContext', 'discord-server-has-unread', false );
        }

        var canMute = false;
        var canUnmute = false;

        if( sc )
        {
            canUnmute = storage.getChannelMuted( sc ) === true;
            canMute = !canUnmute;
        }
        else if( ss )
        {
            canUnmute = storage.getServerMuted( ss ) === true;
            canMute = !canUnmute;
        }

        vscode.commands.executeCommand( 'setContext', 'discord-can-mute', canMute );
        vscode.commands.executeCommand( 'setContext', 'discord-can-unmute', canUnmute );

        var children = provider.getChildren();
        var empty = children.length === 1 && children[ 0 ].empty === true;
        vscode.commands.executeCommand( 'setContext', 'discord-chat-tree-not-empty',
            ( vscode.workspace.getConfiguration( 'discord-chat' ).get( 'hideEmptyTree' ) === false ) || ( empty === false ) );
    }

    function getUnreadMessages( done, channel, messages, before )
    {
        trace( "getUnreadMessages" );
        if( vscode.workspace.getConfiguration( 'discord-chat' ).get( 'fetchUnreadMessages' ) !== true || aborted === true )
        {
            aborted = false;
            done();
        }
        else
        {
            channel.fetchMessages( { limit: 100, before: before } ).then( function( newMessages )
            {
                var storedDate = storage.getLastRead( channel );
                var channelLastRead = new Date( storedDate ? storedDate : 0 );
                var unreadMessages = newMessages.filter( function( message )
                {
                    return message.createdAt > channelLastRead;
                } );

                messages = messages ? messages.concat( unreadMessages.clone() ) : unreadMessages.clone();

                if( unreadMessages.array().length > 0 )
                {
                    getUnreadMessages( done, channel, messages, unreadMessages.last().id );
                }
                else
                {
                    channelMessages[ channel.id.toString() ] = messages;
                    provider.setUnread( channel, messages );
                    done();
                }
            } );
        }
    }

    function populateChannelMessages( user, channels )
    {
        trace( "populateChannelMessages" );
        channels.map( function( channel )
        {
            if( utils.isReadableChannel( user, channel ) && storage.isChannelMuted( channel ) !== true )
            {
                getUnreadMessages( function()
                {
                    var channelId = channel.id.toString();

                    var messages = channelMessages[ channel.id.toString() ];
                    var before = messages && messages.size > 0 ? messages.last().id : undefined;

                    channel.fetchMessages( { limit: vscode.workspace.getConfiguration( 'discord-chat' ).get( 'history' ), before: before } ).then( function( oldMessages )
                    {
                        channelMessages[ channelId ] = messages ? messages.concat( oldMessages.clone() ) : oldMessages.clone();

                        channelMessages[ channelId ].array().reverse().map( function( message )
                        {
                            var compact = vscode.workspace.getConfiguration( 'discord-chat' ).get( 'compactView' );
                            chats.addMessage( channelId, message.id, chats.formatMessage( message, compact ), message.createdAt );
                        } );
                    } );

                    updateToolbarButtons();
                }, channel );
            }
        }, this );
    }

    function populateChannel( channel )
    {
        trace( "populateChannel" );
        var channelId = channel.id.toString();
        streams.outputChannel( channelId, function( outputChannel )
        {
            outputChannel.clear();

            if( storage.getChannelMuted( channel ) !== true )
            {
                chats.getReadMessages( channelId ).map( function( entry )
                {
                    outputChannel.appendLine( entry );
                } );

                chats.getUnreadMessages( channelId ).map( function( entry )
                {
                    outputChannel.appendLine( entry );
                } );
            }
        } );

        var storedDate = storage.getLastRead( channel );
        var channelLastRead = new Date( storedDate ? storedDate : 0 );

        chats.chatRead( channelId, channelLastRead );
    }

    function refresh()
    {
        trace( "refresh" );
        function onSync()
        {
            trace( "onSync" );
            provider.startFetch();

            var pending = client.guilds ? client.guilds.size : 0;
            var icons = {};

            function checkFinished()
            {
                trace( "checkFinished" );
                --pending;
                if( pending === 0 )
                {
                    provider.setIcons( icons );
                    provider.populate( client.user, client.channels );

                    populateChannelMessages( client.user, client.channels );

                    provider.refresh();

                    updateToolbarButtons();
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
                    populateChannelMessages( client.user, client.channels );

                    provider.refresh();
                    updateToolbarButtons();
                }
            }
        }

        storage.sync( onSync );
    }

    function addMessageToChannel( message, isEdit )
    {
        trace( "addMessageToChannel" );
        var channelId = message.channel.id.toString();

        var compact = vscode.workspace.getConfiguration( 'discord-chat' ).get( 'compactView' );
        var formattedMessage = chats.formatMessage( message, compact );
        chats.addMessage( channelId, message.id, formattedMessage, message.createdAt );

        if( isEdit === true )
        {
            streams.outputChannel( channelId, function( outputChannel )
            {
                outputChannel.clear();
            } );
            populateChannel( message.channel );
        }
        else
        {
            streams.outputChannel( channelId, function( outputChannel )
            {
                formattedMessage.map( function( line )
                {
                    outputChannel.appendLine( line );
                } );
            } );
        }
    }

    function updateCurrentChannel( message, isEdit )
    {
        trace( "updateCurrentChannel" );
        addMessageToChannel( message, isEdit );
        streams.autoHide( message.channel.id.toString() );
    }

    function selectServer()
    {
        trace( "selectServer" );
    }

    function revealElement( element, focus, select )
    {
        trace( "revealElement" );
        if( element !== undefined )
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
    }

    function updateChannel( message, hidden, isEdit )
    {
        trace( "updateChannel" );
        function showNotification()
        {
            trace( "showNotification" );
            var notify = vscode.workspace.getConfiguration( 'discord-chat' ).get( 'notify' );
            if( notify === "always" || ( notify == "whenHidden" && hidden === true ) )
            {
                var compact = vscode.workspace.getConfiguration( 'discord-chat' ).get( 'compactView' );
                vscode.window.showInformationMessage( "[" + chats.formatMessage( message, compact, true ).join() + "](command:discord-chat.openChannel?" + JSON.stringify( message.channel.id ) + ")" );
            }
        }

        addMessageToChannel( message, isEdit );

        if( isEdit !== true )
        {
            provider.update( message );

            if( vscode.window.state.focused )
            {
                showNotification();
            }
        }
    }

    function updateViewSelection()
    {
        trace( "updateViewSelection" );
        streams.updateVisibleEditors( vscode.window.visibleTextEditors, onOutputChannelVisible, onOutputChannelNoLongerVisible );
        clearTimeout( selectionChangedTimeout );
        selectionChangedTimeout = setTimeout( selectionChanged, 200 );
    }

    function openChannel( channel )
    {
        trace( "openChannel" );
        if( typeof channel === 'string' )
        {
            channel = client.channels.get( channel );
        }
        if( channel )
        {
            streams.autoHide( channel.id.toString() );
            streams.open( channel, context.subscriptions, populateChannel, streams.fadeOldMessages );
        }
    }

    function selectionChanged()
    {
        trace( "selectionChanged" );
        handlingSelectionChanged = true;
        var sc = selectedChannel();
        var ss = selectedServer();

        if( sc )
        {
            openChannel( sc );
        }
        else
        {
            streams.hideOutputChannel();
            if( ss )
            {
                revealElement( provider.getServerElement( ss ), false, true );
            }
        }
        provider.setCurrentChannel( sc );
        updateToolbarButtons();
    }

    function setShowUnreadOnly( enabled )
    {
        trace( "setShowUnreadOnly" );
        context.workspaceState.update( 'showUnreadOnly', enabled );
        vscode.commands.executeCommand( 'setContext', 'discord-show-unread-only', context.workspaceState.get( 'showUnreadOnly' ) );
        provider.refresh();
    }

    function onOutputChannelVisible( channel )
    {
        trace( "onOutputChannelVisible" );
        if( channel !== selectedChannel() )
        {
            provider.setCurrentChannel( channel );
            revealElement( provider.getChannelElement( channel ), false, true );
        }

        updateToolbarButtons();
        streams.highlightUserNames();
        streams.fadeOldMessages();
    }

    function onOutputChannelNoLongerVisible( channel )
    {
        trace( "onOutputChannelNoLongerVisible" );
        var sc = selectedChannel();
        if( sc && channel.id === sc.id )
        {
            revealElement( provider.getParent( provider.getChannelElement( sc ) ), false, true );
        }
    }

    function register()
    {
        trace( "register" );
        updateToolbarButtons();

        discordChatExplorerView = vscode.window.createTreeView( 'discord-chat-view-explorer', { treeDataProvider: provider } );
        discordChatView = vscode.window.createTreeView( 'discord-chat-view', { treeDataProvider: provider } );

        context.subscriptions.push( discordChatExplorerView );
        context.subscriptions.push( discordChatView );

        context.subscriptions.push( discordChatExplorerView.onDidExpandElement( selectServer ) );
        context.subscriptions.push( discordChatExplorerView.onDidCollapseElement( selectServer ) );
        context.subscriptions.push( discordChatView.onDidExpandElement( selectServer ) );
        context.subscriptions.push( discordChatView.onDidCollapseElement( selectServer ) );
        context.subscriptions.push( discordChatExplorerView.onDidChangeVisibility( updateViewSelection ) );
        context.subscriptions.push( discordChatView.onDidChangeVisibility( updateViewSelection ) );
        context.subscriptions.push( discordChatExplorerView.onDidChangeSelection( e => selectionChanged( e ) ) );
        context.subscriptions.push( discordChatView.onDidChangeSelection( e => selectionChanged( e ) ) );

        context.subscriptions.push( vscode.commands.registerCommand( 'discord-chat.refresh', refresh ) );
        context.subscriptions.push( vscode.commands.registerCommand( 'discord-chat.openChannel', openChannel ) );
        context.subscriptions.push( vscode.commands.registerCommand( 'discord-chat.showAll', function() { setShowUnreadOnly( false ); } ) );
        context.subscriptions.push( vscode.commands.registerCommand( 'discord-chat.showUnreadOnly', function() { setShowUnreadOnly( true ); } ) );

        context.subscriptions.push( vscode.commands.registerCommand( 'discord-chat.markAllRead', function() { provider.markAllRead(); } ) );
        context.subscriptions.push( vscode.commands.registerCommand( 'discord-chat.resetSync', function() { storage.resetSync(); } ) );
        context.subscriptions.push( vscode.commands.registerCommand( 'discord-chat.resetChannelUnread', function() { storage.resetChannel( selectedChannel() ); } ) );

        context.subscriptions.push( vscode.commands.registerCommand( 'discord-chat.abort', function()
        {
            trace( "discord-chat.abort" );
            aborted = true;
        } ) );

        context.subscriptions.push( vscode.commands.registerCommand( 'discord-chat.statusButtonPressed', function()
        {
            trace( "discord-chat.statusButtonPressed" );
            setShowUnreadOnly( true );
            if( vscode.workspace.getConfiguration( 'discord-chat' ).get( 'showInExplorer' ) )
            {
                if( discordChatExplorerView && discordChatExplorerView.visible === false )
                {
                    discordChatExplorerView.reveal( provider.getFirstVisibleChannel(), { select: true } );
                }
            }
            else
            {
                if( discordChatView && discordChatView.visible === false )
                {
                    discordChatView.reveal( provider.getFirstVisibleChannel(), { select: true } );
                }
            }
        } ) );

        context.subscriptions.push( vscode.commands.registerCommand( 'discord-chat.markChannelRead', function( element )
        {
            trace( "discord-chat.markChannelRead" );
            var sc = element && element.channel ? element.channel : selectedChannel();
            if( sc )
            {
                provider.markChannelRead( sc );
                chats.chatRead( sc.id.toString(), new Date() );
                updateToolbarButtons();
                clearTimeout( decorateTimeout );
                decorateTimeout = setTimeout( function()
                {
                    streams.fadeOldMessages();
                }, 100 );
            }
        } ) );

        context.subscriptions.push( vscode.commands.registerCommand( 'discord-chat.markServerRead', function( element )
        {
            trace( "discord-chat.markServerRead" );
            var ss = element && element.server ? element.server : selectedServer();
            if( ss )
            {
                provider.markServerRead( ss );
                updateToolbarButtons();
            }
        } ) );

        context.subscriptions.push( vscode.commands.registerCommand( 'discord-chat.createChannel', function()
        {
            trace( "discord-chat.createChannel" );
            var ss = selectedServer();
            if( ss )
            {
                vscode.window.showInputBox( { prompt: "Channel name:" } ).then(
                    function( name )
                    {
                        if( name )
                        {
                            ss.createChannel( name, 'text' ).then( function( channel )
                            {
                                refresh();
                            } ).catch( e =>
                            {
                                vscode.window.showErrorMessage( e.message );
                            } );
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
            trace( "discord-chat.deleteChannel" );
            var sc = selectedChannel();
            if( sc )
            {
                vscode.window.showInformationMessage( "discord-chat: Are you sure?", "Yes", "No" ).then( response =>
                {
                    if( response === "Yes" )
                    {
                        sc.delete().then( function()
                        {
                            streams.remove( sc.id.toString() );
                            revealElement( provider.getParent( provider.getChannelElement( sc ) ), false, true );
                            provider.deleteChannelElement( sc );
                        } ).catch( e =>
                        {
                            console.error( e.message );
                            vscode.window.showErrorMessage( "Failed to delete channel" );
                        } );
                    }
                } );
            }
            else
            {
                vscode.window.showInformationMessage( "discord-chat: Please select a channel first" );
            }
        } ) );

        context.subscriptions.push( vscode.commands.registerCommand( 'discord-chat.closeChannel', function()
        {
            trace( "discord-chat.closeChannel" );
            var sc = selectedChannel();
            if( sc )
            {
                streams.remove( sc.id.toString() );
                revealElement( provider.getParent( provider.getChannelElement( sc ) ), false, true );
            }
            else
            {
                vscode.window.showInformationMessage( "discord-chat: Please select a channel first" );
            }
        } ) );


        context.subscriptions.push( vscode.commands.registerCommand( 'discord-chat.leaveServer', function()
        {
            trace( "discord-chat.leaveServer" );
            var ss = selectedServer();
            if( ss )
            {
                vscode.window.showInformationMessage( "discord-chat: Are you sure?", "Yes", "No" ).then( response =>
                {
                    if( response === "Yes" )
                    {
                        ss.channels.map( function( channel )
                        {
                            streams.remove( channel.id.toString() );
                        } );

                        ss.leave().then( function()
                        {
                            refresh();
                        }
                        ).catch( e =>
                        {
                            console.error( e.message );
                            vscode.window.showErrorMessage( "Failed to leave server" );
                        } );
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
            trace( "discord-chat.post" );
            var sc = selectedChannel();
            if( sc )
            {
                streams.cancelAutoHide( sc.id.toString() );

                vscode.window.showInputBox( { prompt: "Post message to " + utils.toChannelName( sc ) } ).then(
                    function( message )
                    {
                        if( message )
                        {
                            sc.send( message ).then( message =>
                            {
                                utils.log( "Sent message to channel " + sc.name + " at " + new Date().toISOString() );
                                provider.markChannelRead( message.channel );
                            } ).catch( e =>
                            {
                                console.error( "Failed to send: " + e );
                            } );
                        }
                    } );
            }
            else
            {
                vscode.window.showInformationMessage( "discord-chat: Please select a channel first" );
            }
        } ) );

        context.subscriptions.push( vscode.commands.registerCommand( 'discord-chat.editPost', function()
        {
            trace( "discord-chat.editPost" );
            var sc = selectedChannel();
            if( sc )
            {
                streams.cancelAutoHide( sc );

                var myMessages = channelMessages[ sc.id.toString() ].filter( function( message )
                {
                    return message.author.equals( client.user );
                } );
                var entries = [];
                myMessages.array().map( function( message )
                {
                    entries.push(
                        {
                            label: strftime( utils.messageTimeFormat( message ), message.createdAt ) + " " + message.cleanContent.substr( 0, 30 ),
                            message: message
                        } );
                } );
                vscode.window.showQuickPick( entries ).then( function( entry )
                {
                    if( entry )
                    {
                        vscode.window.showInputBox( {
                            value: entry.message.cleanContent,
                            prompt: "Please edit your message:"
                        } ).then( function( newMessage )
                        {
                            if( newMessage )
                            {
                                var channelId = entry.message.channel.id.toString();
                                entry.message.edit( newMessage ).then( function()
                                {
                                    streams.reset( channelId );
                                    chats.reset( channelId );
                                    channelMessages[ channelId ].array().map( function( message )
                                    {
                                        var compact = vscode.workspace.getConfiguration( 'discord-chat' ).get( 'compactView' );
                                        chats.addMessage( channelId, message.id, chats.formatMessage( message, compact ), message.createdAt );
                                    } );
                                    populateChannel( entry.message.channel );
                                } );
                            }
                        } );
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
            trace( "discord-chat.postSelection" );
            var editor = vscode.window.activeTextEditor;
            var sc = selectedChannel();

            if( sc && editor && editor.document )
            {
                if( editor.selection && editor.selection.start != editor.selection.end )
                {
                    var document = editor.document;
                    var selection = document.getText().substring( document.offsetAt( editor.selection.start ), document.offsetAt( editor.selection.end ) );
                    var language = document.languageId;
                    sc.send( selection, { code: language } );
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
            trace( "discord-chat.mute" );
            var sc = selectedChannel();
            var ss = selectedServer();
            if( sc )
            {
                if( sc.type === 'text' )
                {
                    provider.setChannelMuted( sc, true );
                }
                else
                {
                    vscode.window.showInformationMessage( "discord-chat: direct message channels can't be muted" );
                }
            }
            else if( ss )
            {
                provider.setServerMuted( ss, true );
            }

            updateToolbarButtons();
        } ) );

        context.subscriptions.push( vscode.commands.registerCommand( 'discord-chat.unmute', function()
        {
            trace( "discord-chat.unmute" );
            var sc = selectedChannel();
            var ss = selectedServer();
            if( sc )
            {
                provider.setChannelMuted( sc, undefined );
            }
            else if( ss )
            {
                provider.setServerMuted( ss, undefined );
            }

            updateToolbarButtons();
        } ) );

        context.subscriptions.push( vscode.commands.registerCommand( 'discord-chat.openDebugConsole', function()
        {
            trace( "discord-chat.openDebugConsole" );
            generalOutputChannel.show( true );
        } ) );

        context.subscriptions.push( vscode.commands.registerCommand( 'discord-chat.selectServer', selectServer ) );

        context.subscriptions.push( vscode.workspace.onDidOpenTextDocument( function( e )
        {
            trace( "vscode.workspace.onDidOpenTextDocument" );
            if( e.uri.scheme === "output" )
            {
                streams.outputChannelCreated( e.fileName );
            }
        } ) );

        context.subscriptions.push( vscode.window.onDidChangeWindowState( function( e )
        {
            trace( "vscode.workspace.onDidChangeWindowState" );
            storage.setActive( e.focused );
            if( e.focused )
            {
                refresh();
            }
        } ) );

        context.subscriptions.push( vscode.window.onDidChangeVisibleTextEditors( function( editors )
        {
            trace( "vscode.workspace.onDidChangeVisibleTextEditors" );
            streams.updateVisibleEditors( editors, onOutputChannelVisible, onOutputChannelNoLongerVisible );
        } ) );

        context.subscriptions.push( vscode.workspace.onDidChangeTextDocument( function( e )
        {
            trace( "vscode.workspace.onDidChangeTextDocument" );
            clearTimeout( decorateTimeout );
            decorateTimeout = setTimeout( function()
            {
                streams.highlightUserNames();
                streams.fadeOldMessages();
            }, 100 );
        } ) );

        context.subscriptions.push( vscode.window.onDidChangeActiveTextEditor( function( e )
        {
            trace( "vscode.workspace.onDidChangeActiveTextEditor" );
            if( e && e.document )
            {
                var channelId = streams.getChannelId( e.document.fileName );
                if( channelId )
                {
                    streams.cancelAutoHide( channelId );
                }
                vscode.commands.executeCommand( 'setContext', 'discord-channel-focused', channelId !== undefined );
            }
        } ) );

        context.subscriptions.push( vscode.workspace.onDidChangeConfiguration( function( e )
        {
            trace( "vscode.workspace.onDidChangeConfiguration" );
            if( e.affectsConfiguration( 'discord-chat.showInExplorer' ) )
            {
                vscode.commands.executeCommand( 'setContext', 'discord-chat-in-explorer', vscode.workspace.getConfiguration( 'discord-chat' ).get( 'showInExplorer' ) );
            }
            else if( e.affectsConfiguration( 'discord-chat.hideEmptyTree' ) )
            {
                updateToolbarButtons();
            }
            else if( e.affectsConfiguration( 'discord-chat.token' ) && client.readyAt === null )
            {
                login();
            }
            else if(
                e.affectsConfiguration( 'discord-chat.compactView' ) ||
                e.affectsConfiguration( 'discord-chat.history' ) )
            {
                streams.reset();
                chats.reset();
                Object.keys( channelMessages ).map( function( id )
                {
                    channelMessages[ id ].array().map( function( message )
                    {
                        var compact = vscode.workspace.getConfiguration( 'discord-chat' ).get( 'compactView' );
                        chats.addMessage( id, message.id, chats.formatMessage( message, compact ), message.createdAt );
                    } );
                } );
                client.channels.map( function( channel )
                {
                    populateChannel( channel );
                } );
            }
            else if( e.affectsConfiguration( 'discord-chat.useIcons' ) )
            {
                refresh();
            }
            else if(
                e.affectsConfiguration( 'discord-chat.hideMutedServers' ) ||
                e.affectsConfiguration( 'discord-chat.hideMutedChannels' ) )
            {
                provider.refresh();
            }
            else if(
                e.affectsConfiguration( 'discord-chat.syncToken' ) ||
                e.affectsConfiguration( 'discord-chat.syncGistId' ) )
            {
                storage.initializeSync();
            }
        } ) );

        context.subscriptions.push( generalOutputChannel );

        vscode.commands.executeCommand( 'setContext', 'discord-chat-in-explorer', vscode.workspace.getConfiguration( 'discord-chat' ).get( 'showInExplorer' ) );
        vscode.commands.executeCommand( 'setContext', 'discord-show-unread-only', context.workspaceState.get( 'showUnreadOnly' ) );

        client.on( 'error', error =>
        {
            utils.log( "error: " + error.message );
        } );
        client.on( 'warn', warning =>
        {
            utils.log( "warning: " + warning );
        } );
        client.on( 'debug', message =>
        {
            if( vscode.workspace.getConfiguration( 'discord-chat' ).get( 'debug' ) === true )
            {
                utils.log( "debug: " + message );
            }
        } );

        client.on( 'ready', () =>
        {
            utils.log( "Logged in as " + client.user.tag );
            refresh();
        } );

        client.on( 'message', message =>
        {
            trace( "client.on.message" );
            if( utils.isReadableChannel( client.user, message.channel ) )
            {
                if( storage.isChannelMuted( message.channel ) !== true )
                {
                    var outputChannelName = utils.toOutputChannelName( message.channel );

                    utils.log( "Received message on " + outputChannelName );

                    if( outputChannelName )
                    {
                        var hidden = selectedChannel() === undefined;
                        var focused = vscode.window.state.focused;
                        if( hidden && focused === true && vscode.workspace.getConfiguration( 'discord-chat' ).get( 'autoShow' ) === true )
                        {
                            openChannel( message.channel );
                            hidden = false;
                        }

                        if( hidden )
                        {
                            updateChannel( message, hidden, false );
                        }
                        else
                        {
                            updateCurrentChannel( message, false );
                            provider.incrementUnread( message.channel );
                        }
                    }

                    updateToolbarButtons();
                }
            }
        } );

        client.on( 'messageUpdate', ( oldMessage, newMessage ) =>
        {
            trace( "client.on.messageUpdate" );
            if( utils.isReadableChannel( client.user, oldMessage.channel ) )
            {
                if( storage.isChannelMuted( oldMessage.channel ) !== true )
                {
                    var outputChannelName = utils.toOutputChannelName( oldMessage.channel );

                    utils.log( "Updated message on " + outputChannelName );

                    if( outputChannelName )
                    {
                        var hidden = selectedChannel() === undefined;
                        if( hidden )
                        {
                            updateChannel( newMessage, hidden, true );
                        }
                        else
                        {
                            updateCurrentChannel( newMessage, true );
                        }
                    }
                }
            }
        } );
        setTimeout( login, 1000 );
    }

    register();

    return storage;
}

function deactivate()
{
}

exports.activate = activate;
exports.deactivate = deactivate;
