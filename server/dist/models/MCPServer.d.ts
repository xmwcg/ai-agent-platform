import mongoose, { Document } from 'mongoose';
export interface IMCPServer extends Document {
    id: string;
    name: string;
    description?: string;
    transport: 'stdio' | 'sse';
    command?: string;
    args?: string[];
    url?: string;
    env?: Record<string, string>;
    enabled: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare const MCPServer: mongoose.Model<IMCPServer, {}, {}, {}, mongoose.Document<unknown, {}, IMCPServer, {}, {}> & IMCPServer & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=MCPServer.d.ts.map