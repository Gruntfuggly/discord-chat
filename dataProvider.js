/* jshint esversion:6 */

Object.defineProperty( exports, "__esModule", { value: true } );

var path = require( 'path' );
var vscode = require( 'vscode' );

var lastRead = require( './lastRead' );

var servers = [];

const SERVER = "server";
const CHANNEL = "channel";

function findServer( e )
{
    return e.type === SERVER && e.id.toString() === this.toString();
};

function findChannel( e )
{
    return e.type === CHANNEL && e.id.toString() === this.toString();
};

function parentId( channel )
{
    if( channel.guild )
    {
        return channel.guild.id;
    }
    return channel.ownerID;
}

function serverName( channel )
{
    return channel.guild ? channel.guild.name : "Direct Messages";
}

function channelName( channel )
{
    var name = channel.name;
    if( !name )
    {
        var names = [];
        channel.recipients.map( recipient =>
        {
            names.push( recipient.username );
        } );
        name = names.join( ", " );
    }
    return name;
}

var status = vscode.window.createStatusBarItem( vscode.StatusBarAlignment.Left, 0 );

class DiscordChatDataProvider
{
    constructor( _context )
    {
        this._context = _context;

        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    updateStatus()
    {
        var unread = this.unreadCount();
        status.text = "$(comment-discussion)" + unread;
        if( unread > 0 )
        {
            status.show();
        }
        else
        {
            status.hide();
        }
    }

    getParent( element )
    {
        return element.parent;
    }

    getChildren( element )
    {
        if( !element )
        {
            if( servers.length > 0 )
            {
                return servers;
            }
            return [ { name: "..." } ];
        }
        else if( element.type === SERVER )
        {
            return element.channels;
        }
        else if( element.type === CHANNEL )
        {
            return element.name;
        }
    }

    getIcon( name )
    {
        var darkIconPath = this._context.asAbsolutePath( path.join( "resources/icons", "dark", name + ".svg" ) );
        var lightIconPath = this._context.asAbsolutePath( path.join( "resources/icons", "light", name + ".svg" ) );

        return {
            dark: darkIconPath,
            light: lightIconPath
        };
    }

    getTreeItem( element )
    {
        var treeItem = new vscode.TreeItem( element.name );

        treeItem.id = element.id;

        treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;

        if( element.type === SERVER )
        {
            treeItem.iconPath = this.getIcon( SERVER );
            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
            treeItem.tooltip = "";
            treeItem.command = {
                command: "discord-chat.selectServer",
                title: "Select server",
                arguments: [
                    element.server
                ]
            };
        }
        else if( element.type === CHANNEL )
        {
            treeItem.iconPath = this.getIcon( CHANNEL );
            treeItem.tooltip = "Open channel";
            treeItem.command = {
                command: "discord-chat.openChannel",
                title: "Open channel",
                arguments: [
                    element.channel
                ]
            };
        }

        if( element.unreadCount && element.unreadCount > 0 )
        {
            treeItem.label = element.name +
                " (" + element.unreadCount +
                ( element.unreadCount >= vscode.workspace.getConfiguration( 'discord-chat' ).history ? "+" : "" ) +
                ")";
        }

        return treeItem;
    }

    populate( channels )
    {
        var me = this;

        servers = [];

        channels.map( function( channel )
        {
            if( channel.type === "text" || channel.type === "dm" || channel.type === "group" )
            {
                var server = servers.find( findServer, parentId( channel ) );
                if( server === undefined )
                {
                    server = { type: SERVER, name: serverName( channel ), server: server, channels: [], id: parentId( channel ), unreadCount: 0 };
                    servers.push( server );
                }

                var channelElement = server.channels.find( findChannel, channel.id );
                if( channelElement === undefined )
                {
                    channelElement = { type: CHANNEL, name: channelName( channel ), channel: channel, users: [], id: channel.id, unreadCount: 0, parent: server };
                    server.channels.push( channelElement );
                }

                channel.fetchMessages( { limit: vscode.workspace.getConfiguration( 'discord-chat' ).history } ).then( function( messages )
                {
                    me.setUnread( channel, messages );
                } );
            }
        } );
    }

    updateServerCount( server )
    {
        if( server )
        {
            server.unreadCount = server.channels.reduce( ( total, channel ) => total + channel.unreadCount, 0 );
            this._onDidChangeTreeData.fire();
        }
        this.updateStatus();
    }

    getChannelElement( channel )
    {
        var channelElement;
        var server = servers.find( findServer, parentId( channel ) );
        if( server )
        {
            channelElement = server.channels.find( findChannel, channel.id );
        }
        return channelElement;
    }

    unreadCount()
    {
        return servers.reduce( ( total, server ) => total + server.unreadCount, 0 );
    }

    update( message )
    {
        var channelElement = this.getChannelElement( message.channel );
        if( channelElement )
        {
            ++channelElement.unreadCount;
            this.updateServerCount( servers.find( findServer, parentId( message.channel ) ) );
        }
    }

    setUnread( channel, messages )
    {
        var channelElement = this.getChannelElement( channel );
        if( channelElement )
        {
            var storedDate = lastRead.getLastRead( channel );
            var channelLastRead = new Date( storedDate ? storedDate : 0 );
            channelElement.unreadCount = messages.reduce( ( total, message ) => total + ( message.createdAt > channelLastRead ? 1 : 0 ), 0 );
            this.updateServerCount( servers.find( findServer, parentId( channel ) ) );
        }
    }

    markRead( channel )
    {
        var channelElement = this.getChannelElement( channel );
        if( channelElement )
        {
            channelElement.unreadCount = 0;
            lastRead.setLastRead( channel );
            this.updateServerCount( servers.find( findServer, parentId( channel ) ) );
        }
    }

    refresh()
    {
        this._onDidChangeTreeData.fire();
    }
}

exports.DiscordChatDataProvider = DiscordChatDataProvider;
