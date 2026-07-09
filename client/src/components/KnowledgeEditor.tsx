import { useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import {
  BoldOutlined, ItalicOutlined, StrikethroughOutlined,
  OrderedListOutlined, UnorderedListOutlined,
  CodeOutlined, UndoOutlined, RedoOutlined
} from '@ant-design/icons';
import { Button, Space, Segmented } from 'antd';
import type { AnyExtension } from '@tiptap/react';

interface KnowledgeEditorProps {
  initialContent?: string;
  onSave: (content: string) => void;
  saving?: boolean;
}

export default function KnowledgeEditor({ initialContent = '', onSave, saving = false }: KnowledgeEditorProps) {
  const extensions: AnyExtension[] = useMemo(
    () => [StarterKit, Placeholder.configure({ placeholder: '在此输入内容...' })],
    []
  );

  const editor = useEditor({
    extensions,
    content: initialContent,
    editorProps: {
      attributes: {
        class: 'tiptap-editor-content'
      }
    }
  });

  if (!editor) return null;

  // 链接功能（需安装 @tiptap/extension-link）
  // const addLink = () => { ... };
  const toggleView = (mode: string) => {
    if (mode === 'preview') {
      alert('预览模式：实际项目中可用 Markdown 渲染预览');
    }
  };

  return (
    <div className="tiptap-editor-wrapper">
      {/* 工具栏 */}
      <div style={{ marginBottom: 12, padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
        <Space wrap size={[4, 4]}>
          <Button
            size="small" icon={<BoldOutlined />}
            type={editor.isActive('bold') ? 'primary' : 'default'}
            onClick={() => editor.chain().focus().toggleBold().run()}
          />
          <Button
            size="small" icon={<ItalicOutlined />}
            type={editor.isActive('italic') ? 'primary' : 'default'}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          />
          <Button
            size="small" icon={<StrikethroughOutlined />}
            type={editor.isActive('strike') ? 'primary' : 'default'}
            onClick={() => editor.chain().focus().toggleStrike().run()}
          />
          <span style={{ width: 1, height: 20, background: '#e8e8e8', display: 'inline-block' }} />
          <Button
            size="small" icon={<UnorderedListOutlined />}
            type={editor.isActive('bulletList') ? 'primary' : 'default'}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          />
          <Button
            size="small" icon={<OrderedListOutlined />}
            type={editor.isActive('orderedList') ? 'primary' : 'default'}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          />
          <span style={{ width: 1, height: 20, background: '#e8e8e8', display: 'inline-block' }} />
          <Button
            size="small" icon={<CodeOutlined />}
            type={editor.isActive('codeBlock') ? 'primary' : 'default'}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          />
          {/*<Button
            size="small" icon={<LinkOutlined />}
            onClick={addLink}
          />*/}  {/* 链接需安装 @tiptap/extension-link */}
          <span style={{ width: 1, height: 20, background: '#e8e8e8', display: 'inline-block' }} />
          <Button
            size="small" icon={<UndoOutlined />}
            onClick={() => editor.chain().focus().undo().run()}
          />
          <Button
            size="small" icon={<RedoOutlined />}
            onClick={() => editor.chain().focus().redo().run()}
          />
          <span style={{ width: 1, height: 20, background: '#e8e8e8', display: 'inline-block' }} />
          <Segmented
            size="small"
            options={['edit', 'preview']}
            onChange={toggleView}
          />
        </Space>
      </div>

      {/* 编辑器内容区 */}
      <div
        onClick={() => editor.chain().focus().run()}
        style={{ minHeight: 400, cursor: 'text' }}
      >
        <EditorContent editor={editor} />
      </div>

      {/* 保存按钮 */}
      <div style={{ marginTop: 16, textAlign: 'right' }}>
        <Button
          type="primary"
          loading={saving}
          onClick={() => onSave(editor.getHTML())}
        >
          保存文档
        </Button>
      </div>

      {/* Tiptap 编辑器样式 */}
      <style>{`
        .tiptap-editor-content {
          min-height: 400px;
          padding: 0 8px;
          outline: none;
        }
        .tiptap-editor-content h1 { font-size: 2em; margin: 0.67em 0; }
        .tiptap-editor-content h2 { font-size: 1.5em; margin: 0.75em 0; }
        .tiptap-editor-content h3 { font-size: 1.17em; margin: 0.83em 0; }
        .tiptap-editor-content p { margin: 0.5em 0; line-height: 1.7; }
        .tiptap-editor-content ul, .tiptap-editor-content ol { padding-left: 1.5em; }
        .tiptap-editor-content code {
          background: #f5f5f5;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 0.9em;
        }
        .tiptap-editor-content pre {
          background: #f6f8fa;
          padding: 16px;
          border-radius: 8px;
          overflow-x: auto;
        }
        .tiptap-editor-content pre code {
          background: transparent;
          padding: 0;
        }
        .tiptap-editor-content a { color: #1890ff; }
        .tiptap-editor-content blockquote {
          border-left: 4px solid #1890ff;
          padding-left: 16px;
          color: #666;
          margin: 1em 0;
        }
      `}</style>
    </div>
  );
}
