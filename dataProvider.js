/* jshint esversion:6 */

Object.defineProperty( exports, "__esModule", { value: true } );

var path = require( 'path' );
var vscode = require( 'vscode' );

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
            return [ { name: "Houston - we have a problem..." } ];
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
        }
        else if( element.type === CHANNEL )
        {
            treeItem.iconPath = this.getIcon( CHANNEL );
            treeItem.command = {
                command: "discord-chat.openChannel",
                title: "",
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

    clear()
    {
        servers = [];
    }

    populate( channels )
    {
        var me = this;
        channels.map( function( channel )
        {
            if( channel.guild && channel.type === "text" )
            {
                var server = servers.find( findServer, channel.guild.id );
                if( server === undefined )
                {
                    server = { type: SERVER, name: channel.guild.name, channels: [], id: channel.guild.id, unreadCount: 0 };
                    servers.push( server );
                }

                var channelElement = server.channels.find( findChannel, channel.id );
                if( channelElement === undefined )
                {
                    channelElement = { type: CHANNEL, name: channel.name, channel: channel, users: [], id: channel.id, unreadCount: 0, parent: server };
                    server.channels.push( channelElement );

                    channel.fetchMessages( { limit: vscode.workspace.getConfiguration( 'discord-chat' ).history } ).then( function( messages )
                    {
                        me.setUnread( channel, messages );
                    } );
                }
            }
        } );
    }

    updateServerCount( server )
    {
        if( server )
        {
            var total = 0;
            server.channels.map( channel =>
            {
                total += channel.unreadCount;
            } );
            server.unreadCount = total;
            this._onDidChangeTreeData.fire();
        }
        this.updateStatus();
    }

    getChannelElement( channel )
    {
        var channelElement;
        var server = servers.find( findServer, channel.guild.id );
        if( server )
        {
            channelElement = server.channels.find( findChannel, channel.id );
        }
        return channelElement;
    }

    unreadCount()
    {
        var total = 0;
        servers.map( server =>
        {
            total += server.unreadCount;
        } );
        return total;
    }

    update( message )
    {
        var channelElement = this.getChannelElement( message.channel );
        if( channelElement )
        {
            channelElement.unreadCount += 1;
        }
        this.updateServerCount( servers.find( findServer, message.channel.guild.id ) );
    }

    setUnread( channel, messages )
    {
        var storedDate = this._context.workspaceState.get( "read.discord-chat" + channel.id );
        var lastRead = new Date( storedDate ? storedDate : 0 );
        var unread = 0;
        messages.map( message =>
        {
            if( message.createdAt > lastRead )
            {
                unread++;
            }
        } );
        var channelElement = this.getChannelElement( channel );
        if( channelElement )
        {
            channelElement.unreadCount = unread;
        }
        this.updateServerCount( servers.find( findServer, channel.guild.id ) );
    }

    markRead( channel )
    {
        var channelElement = this.getChannelElement( channel );
        if( channelElement )
        {
            channelElement.unreadCount = 0;
            this._context.workspaceState.update( "read.discord-chat" + channel.id, new Date().toISOString() );
        }
        this.updateServerCount( servers.find( findServer, channel.guild.id ) );
    }

    refresh()
    {
        this._onDidChangeTreeData.fire();
    }
}

exports.DiscordChatDataProvider = DiscordChatDataProvider;
