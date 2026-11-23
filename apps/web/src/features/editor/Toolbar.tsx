import { useEditorState, type Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Underline,
  Undo2,
  type LucideIcon,
} from 'lucide-react';
import { cx } from '../../lib/format';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? '⌘' : 'Ctrl+';

type Block = 'paragraph' | 'h1' | 'h2' | 'h3';

export function Toolbar({ editor }: { editor: Editor }) {
  // Subscribes only the toolbar to selection/format changes — the document itself doesn't re-render.
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      bulletList: e.isActive('bulletList'),
      orderedList: e.isActive('orderedList'),
      blockquote: e.isActive('blockquote'),
      block: (e.isActive('heading', { level: 1 })
        ? 'h1'
        : e.isActive('heading', { level: 2 })
          ? 'h2'
          : e.isActive('heading', { level: 3 })
            ? 'h3'
            : 'paragraph') as Block,
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  const setBlock = (block: Block) => {
    const chain = editor.chain().focus();
    if (block === 'paragraph') chain.setParagraph().run();
    else chain.setHeading({ level: Number(block[1]) as 1 | 2 | 3 }).run();
  };

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="flex items-center gap-0.5 overflow-x-auto rounded-xl border border-line bg-paper px-1.5 py-1 shadow-sheet"
    >
      <ToolButton icon={Undo2} label={`Undo (${mod}Z)`} disabled={!s.canUndo} onClick={() => editor.chain().focus().undo().run()} />
      <ToolButton icon={Redo2} label={`Redo (${mod}Shift+Z)`} disabled={!s.canRedo} onClick={() => editor.chain().focus().redo().run()} />
      <Divider />
      <label className="sr-only" htmlFor="block-style">
        Text style
      </label>
      <select
        id="block-style"
        value={s.block}
        onChange={(e) => setBlock(e.target.value as Block)}
        className="h-8 shrink-0 cursor-pointer rounded-lg bg-transparent px-2 text-sm font-medium hover:bg-desk focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <option value="paragraph">Normal text</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
      </select>
      <Divider />
      <ToolButton icon={Bold} label={`Bold (${mod}B)`} active={s.bold} onClick={() => editor.chain().focus().toggleBold().run()} />
      <ToolButton icon={Italic} label={`Italic (${mod}I)`} active={s.italic} onClick={() => editor.chain().focus().toggleItalic().run()} />
      <ToolButton icon={Underline} label={`Underline (${mod}U)`} active={s.underline} onClick={() => editor.chain().focus().toggleUnderline().run()} />
      <ToolButton icon={Strikethrough} label={`Strikethrough (${mod}Shift+S)`} active={s.strike} onClick={() => editor.chain().focus().toggleStrike().run()} />
      <Divider />
      <ToolButton icon={List} label={`Bulleted list (${mod}Shift+8)`} active={s.bulletList} onClick={() => editor.chain().focus().toggleBulletList().run()} />
      <ToolButton icon={ListOrdered} label={`Numbered list (${mod}Shift+7)`} active={s.orderedList} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
      <ToolButton icon={Quote} label="Quote" active={s.blockquote} onClick={() => editor.chain().focus().toggleBlockquote().run()} />
      <Divider />
      <ToolButton
        icon={RemoveFormatting}
        label="Clear formatting"
        onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
      />
    </div>
  );
}

function ToolButton({
  icon: Icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()} // keep the editor selection
      onClick={onClick}
      className={cx(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors disabled:opacity-35',
        active ? 'bg-accent-wash text-accent' : 'text-ink hover:bg-desk',
      )}
    >
      <Icon className="size-4" strokeWidth={2.25} />
    </button>
  );
}

const Divider = () => <span aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-line" />;
