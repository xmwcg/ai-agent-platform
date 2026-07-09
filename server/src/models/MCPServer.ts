import mongoose, { Schema, Document } from 'mongoose';

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

const mcpServerSchema = new Schema<IMCPServer>(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String },
    transport: { type: String, enum: ['stdio', 'sse'], required: true },
    command: { type: String },
    args: { type: [String] },
    url: { type: String },
    env: { type: Schema.Types.Mixed },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const MCPServer = mongoose.model<IMCPServer>('MCPServer', mcpServerSchema);
