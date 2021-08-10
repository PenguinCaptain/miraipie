import {MiraiPieApp, Plain} from '.';
import {
    Contact,
    FileOverview,
    Friend,
    Group,
    GroupConfig,
    GroupMember,
    GroupPermission,
    MessageChain,
    Profile,
    ResponseCode,
    SingleMessage
} from '../mirai';

/**
 * 聊天窗类型
 */
type ChatWindowType = 'FriendChatWindow' | 'GroupChatWindow' | 'TempChatWindow';

/**
 * 聊天窗口, 用以模拟QQ客户端的聊天环境
 */
export abstract class ChatWindow {
    /**
     * 当前窗口联系人
     */
    readonly contact: Contact;
    /**
     * 聊天窗类型
     */
    readonly type: ChatWindowType;

    /**
     * 发送消息
     * @param messageChain 消息链
     * @param quoteMessageId 引用回复消息id
     */
    protected abstract _send(messageChain: MessageChain, quoteMessageId?: number): Promise<number>;

    /**
     * 发送一条消息<br/>
     * 使用该方法向当前聊天对象发送一条消息
     * @param message 待发送的消息
     * @param quoteMessageId 引用回复的消息id
     * @return
     * 已发送消息的消息id
     * @example
     * window.send('Hello World!');  // 纯文本消息
     * window.send(AtAll());  // 单个单一消息
     * window.send([AtAll(), Plain('Hello World!')]);  // 单一消息列表
     * window.send(new MessageChain(AtAll(), Plain('Hello World!')));  // 消息链对象
     * window.send('Hello World!', 123456);  // 发送消息并引用回复消息
     */
    async send(message: string | SingleMessage | MessageChain | SingleMessage[], quoteMessageId?: number): Promise<number> {
        let messageChain = new MessageChain();
        if (typeof message === 'string') messageChain.push(Plain(message));
        else if (Array.isArray(message)) messageChain = MessageChain.from(message);
        else messageChain.push(message);

        return this._send(messageChain, quoteMessageId);
    }

    /**
     * 向当前聊天对象发送一个头像戳一戳
     * @param targetId 戳一戳行为目标QQ号
     * @return 是否发送成功
     */
    abstract sendNudge(targetId?: number): Promise<boolean>;

    /**
     * 撤回消息
     * @param messageId 消息id
     * @return 是否撤回成功
     */
    async recall(messageId: number): Promise<boolean> {
        const resp = await MiraiPieApp.instance.adapter.recall(messageId);
        return resp?.code === ResponseCode.Success;
    }
}

/**
 * 好友聊天窗
 */
export class FriendChatWindow extends ChatWindow {
    readonly type = 'FriendChatWindow';

    constructor(public readonly contact: Friend) {
        super();
    }

    protected async _send(messageChain: MessageChain, quoteMessageId?: number): Promise<number> {
        const resp = await MiraiPieApp.instance.adapter.sendFriendMessage(this.contact.id, messageChain, quoteMessageId);
        const messageId = resp?.messageId;
        if (messageId) MiraiPieApp.instance.db?.saveMessage(messageId, messageChain, MiraiPieApp.instance.qq, this.contact.id, 'FriendMessage');
        return messageId;
    }

    async sendNudge(targetId?: number): Promise<boolean> {
        const resp = await MiraiPieApp.instance.adapter.sendNudge(targetId || this.contact.id, this.contact.id, 'Friend');
        return resp?.code === ResponseCode.Success;
    }

    /**
     * 获取聊天对象的个人资料
     * @return 聊天对象的个人资料
     */
    async getProfile(): Promise<Profile> {
        const resp = await MiraiPieApp.instance.adapter.getFriendProfile(this.contact.id);
        return resp?.data;
    }

    /**
     * 删除好友(慎用)
     * @return 是否删除成功
     */
    async delete(): Promise<boolean> {
        const resp = await MiraiPieApp.instance.adapter.deleteFriend(this.contact.id);
        return resp?.code === ResponseCode.Success;
    }
}

/**
 * 群聊聊天窗
 */
export class GroupChatWindow extends ChatWindow {
    readonly type = 'GroupChatWindow';

    constructor(public readonly contact: Group) {
        super();
    }

    /**
     * 机器人在本群权限
     */
    get permission(): GroupPermission {
        return this.contact.permission;
    }

    protected async _send(messageChain: MessageChain, quoteMessageId?: number): Promise<number> {
        const resp = await MiraiPieApp.instance.adapter.sendGroupMessage(this.contact.id, messageChain, quoteMessageId);
        const messageId = resp?.messageId;
        if (messageId) MiraiPieApp.instance.db?.saveMessage(messageId, messageChain, MiraiPieApp.instance.qq, this.contact.id, 'GroupMessage');
        return messageId;
    }

    async sendNudge(targetId: number): Promise<boolean> {
        const resp = await MiraiPieApp.instance.adapter.sendNudge(targetId, this.contact.id, 'Group');
        return resp?.code === ResponseCode.Success;
    }

    /**
     * 禁言群成员
     * @param memberId 群成员QQ号
     * @param time 禁言时长(秒)
     * @return 是否禁言成功
     */
    async mute(memberId: number, time: number = 60): Promise<boolean> {
        const resp = await MiraiPieApp.instance.adapter.muteMember(memberId, this.contact.id, time);
        return resp?.code === ResponseCode.Success;
    }

    /**
     * 取消禁言群成员
     * @param memberId 群成员QQ号
     * @return 是否取消成功
     */
    async unmute(memberId: number): Promise<boolean> {
        const resp = await MiraiPieApp.instance.adapter.unmuteMember(memberId, this.contact.id);
        return resp?.code === ResponseCode.Success;
    }

    /**
     * 踢出群成员
     * @param memberId 群成员QQ号
     * @param message 留言
     * @return 是否踢出成功
     */
    async kick(memberId: number, message: string = ''): Promise<boolean> {
        const resp = await MiraiPieApp.instance.adapter.kickMember(memberId, this.contact.id, message);
        return resp?.code === ResponseCode.Success;
    }

    /**
     * 退出群聊
     * @return 是否退出成功
     */
    async quit(): Promise<boolean> {
        const resp = await MiraiPieApp.instance.adapter.quitGroup(this.contact.id);
        return resp?.code === ResponseCode.Success;
    }

    /**
     * 全体禁言
     * @return 是否禁言成功
     */
    async muteAll(): Promise<boolean> {
        const resp = await MiraiPieApp.instance.adapter.muteAll(this.contact.id);
        return resp?.code === ResponseCode.Success;
    }

    /**
     * 取消全体禁言
     * @return 是否取消成功
     */
    async unmuteAll(): Promise<boolean> {
        const resp = await MiraiPieApp.instance.adapter.unmuteAll(this.contact.id);
        return resp?.code === ResponseCode.Success;
    }

    /**
     * 设置群精华消息
     * @param messageId 消息id
     * @return 是否设置成功
     */
    static async setEssence(messageId: number): Promise<boolean> {
        const resp = await MiraiPieApp.instance.adapter.setEssence(messageId);
        return resp?.code === ResponseCode.Success;
    }

    /**
     * 获取群设置
     * @return 群设置
     */
    async getConfig(): Promise<GroupConfig> {
        const resp = await MiraiPieApp.instance.adapter.getGroupConfig(this.contact.id);
        return resp?.data;
    }

    /**
     * 修改群设置
     * @param config 群设置
     * @return 是否修改成功
     */
    async setConfig(config: GroupConfig): Promise<boolean> {
        const resp = await MiraiPieApp.instance.adapter.setGroupConfig(this.contact.id, config);
        return resp?.code === ResponseCode.Success;
    }

    /**
     * 获取群文件列表
     * @param path 文件夹路径
     * @param offset 分页偏移
     * @param size 分页大小
     * @return 文件列表
     */
    async getFileList(path: string = '', offset: number = 0, size: number = 100): Promise<FileOverview[]> {
        const resp = await MiraiPieApp.instance.adapter.getGroupFileList(path, this.contact.id, offset, size);
        return resp?.data;
    }

    /**
     * 获取文件详情
     * @param fileId 文件id
     * @return 文件概览
     */
    async getFileInfo(fileId: string): Promise<FileOverview> {
        const resp = await MiraiPieApp.instance.adapter.getGroupFileInfo(fileId, this.contact.id);
        return resp?.data;
    }

    /**
     * 创建群文件夹
     * @param directoryName 文件夹名称
     * @param parentFileId 父文件夹id
     * @return 文件夹概览
     */
    async createDirectory(directoryName: string, parentFileId: string = ''): Promise<FileOverview> {
        const resp = await MiraiPieApp.instance.adapter.createGroupFileDirectory(parentFileId, directoryName, this.contact.id);
        return resp?.data;
    }

    /**
     * 删除群文件
     * @param fileId 文件id
     * @return 是否删除成功
     */
    async deleteFile(fileId: string): Promise<boolean> {
        const resp = await MiraiPieApp.instance.adapter.deleteGroupFile(fileId, this.contact.id);
        return resp?.code === ResponseCode.Success;
    }

    /**
     * 移动群文件
     * @param fileId 文件id
     * @param moveToDirectoryId 移动到文件夹id
     * @return 是否移动成功
     */
    async moveFile(fileId: string, moveToDirectoryId: string = ''): Promise<boolean> {
        const resp = await MiraiPieApp.instance.adapter.moveGroupFile(fileId, this.contact.id, moveToDirectoryId);
        return resp?.code === ResponseCode.Success;
    }

    /**
     * 重命名群文件
     * @param fileId 文件id
     * @param name 文件名
     * @return 是否重命名成功
     */
    async renameFile(fileId: string, name: string): Promise<boolean> {
        const resp = await MiraiPieApp.instance.adapter.moveGroupFile(fileId, this.contact.id, name);
        return resp?.code === ResponseCode.Success;
    }
}

/**
 * 临时消息聊天窗
 */
export class TempChatWindow extends ChatWindow {
    readonly type = 'TempChatWindow';

    constructor(public readonly contact: GroupMember) {
        super();
    }

    protected async _send(messageChain: MessageChain, quoteMessageId?: number): Promise<number> {
        const resp = await MiraiPieApp.instance.adapter.sendTempMessage(this.contact.id, this.contact.group.id, messageChain, quoteMessageId);
        const messageId = resp?.messageId;
        if (messageId) MiraiPieApp.instance.db?.saveMessage(messageId, messageChain, MiraiPieApp.instance.qq, this.contact.id, 'TempMessage');
        return messageId;
    }

    async sendNudge(targetId?: number): Promise<boolean> {
        const resp = await MiraiPieApp.instance.adapter.sendNudge(targetId || this.contact.id, this.contact.id, 'Stranger');
        return resp?.code === ResponseCode.Success;
    }

    /**
     * 获取聊天对象的个人资料
     * @return 聊天对象的个人资料
     */
    async getProfile(): Promise<Profile> {
        const resp = await MiraiPieApp.instance.adapter.getMemberProfile(this.contact.group.id, this.contact.id);
        return resp?.data;
    }

    /**
     * 获取群成员信息
     * @return 群成员信息
     */
    async getInfo(): Promise<GroupMember> {
        const resp = await MiraiPieApp.instance.adapter.getMemberInfo(this.contact.id, this.contact.group.id);
        return resp?.data;
    }

    /**
     * 修改群成员信息
     * @param info 群成员信息
     * @return 是否修改成功
     */
    async setInfo(info: GroupMember): Promise<boolean> {
        const resp = await MiraiPieApp.instance.adapter.setMemberInfo(this.contact.id, this.contact.group.id, info);
        return resp?.code === ResponseCode.Success;
    }
}
