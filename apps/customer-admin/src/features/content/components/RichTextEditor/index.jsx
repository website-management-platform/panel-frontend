import { useEffect, useId, useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { FiBold, FiCode, FiGrid, FiItalic, FiLink, FiList, FiMessageSquare, FiRotateCcw, FiRotateCw, FiUnderline } from "react-icons/fi";
import Button from "@/components/Button";
import Input from "@/components/Input";
import Popover from "@/components/Popover";
import { cx } from "@/utils/cx";
import "./rich_text_editor.scss";

const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };
const SAFE_URL = /^(https?:\/\/|mailto:|tel:)/i;

// Boş belge (yalnız boş paragraf) değersiz sayılır; zorunluluk denetimi için null döner.
const isEmptyDoc = (doc) => !doc?.content?.some((node) => node.type !== "paragraph" || (node.content ?? []).length > 0);

const ToolbarButton = ({ icon, label, active, disabled, onClick }) => (
  <Button variant={active ? "soft" : "ghost"} size="sm" icon={icon} ariaLabel={label} aria-pressed={active ?? undefined} disabled={disabled} onClick={onClick} />
);

const LinkControl = ({ editor }) => {
  const [open, setOpen] = useState(false);
  const [href, setHref] = useState("");
  const [error, setError] = useState(null);
  const apply = () => {
    const value = href.trim();
    if (!value) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      setOpen(false);
      return;
    }
    if (!SAFE_URL.test(value)) {
      setError("Adres https://, http://, mailto: veya tel: ile başlamalı.");
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: value }).run();
    setOpen(false);
  };
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setHref(editor.getAttributes("link").href ?? "");
          setError(null);
        }
      }}
      ariaLabel="Bağlantı"
      trigger={({ toggle, triggerProps }) => (
        <Button variant={editor.isActive("link") ? "soft" : "ghost"} size="sm" icon={FiLink} ariaLabel="Bağlantı" {...triggerProps} onClick={toggle} />
      )}
    >
      <form className="rich_text_editor_link" onSubmit={(event) => { event.preventDefault(); apply(); }}>
        <Input label="Bağlantı adresi" size="sm" value={href} onChange={(event) => setHref(event.target.value)} error={error} placeholder="https://" autoFocus />
        <div className="rich_text_editor_link_actions">
          {editor.isActive("link") && <Button size="sm" variant="ghost" onClick={() => { editor.chain().focus().unsetLink().run(); setOpen(false); }}>Kaldır</Button>}
          <Button size="sm" type="submit">Uygula</Button>
        </div>
      </form>
    </Popover>
  );
};

/**
 * Zengin metin düzenleyici (TipTap). Değer ProseMirror JSON'udur ve şemadaki biçimle birebir aynıdır (05-schema.md §4).
 * İzin verilen öğeler alanın allowedNodes ayarından gelir; izinsiz öğe araç çubuğunda yer almaz ve yapıştırmada temizlenir.
 */
const RichTextEditor = ({ value, onChange, allowedNodes = [], disabled = false, labelledBy, describedBy, invalid }) => {
  const allow = new Set(allowedNodes);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: allow.has("heading") ? { levels: [2, 3, 4] } : false,
        bulletList: allow.has("list") ? {} : false,
        orderedList: allow.has("list") ? {} : false,
        listItem: allow.has("list") ? {} : false,
        listKeymap: allow.has("list") ? {} : false,
        blockquote: allow.has("quote") ? {} : false,
        codeBlock: allow.has("code") ? {} : false,
        code: allow.has("code") ? {} : false,
        link: allow.has("link") ? { openOnClick: false, autolink: false, protocols: ["mailto", "tel"], HTMLAttributes: { rel: "noopener noreferrer nofollow", target: null } } : false,
        horizontalRule: false,
      }),
      ...(allow.has("table") ? [Table.configure({ resizable: false }), TableRow, TableHeader, TableCell] : []),
    ],
    content: value ?? EMPTY_DOC,
    editable: !disabled,
    editorProps: {
      attributes: {
        class: "rich_text_editor_content",
        role: "textbox",
        "aria-multiline": "true",
        ...(labelledBy ? { "aria-labelledby": labelledBy } : {}),
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
        ...(invalid ? { "aria-invalid": "true" } : {}),
      },
    },
    onUpdate: ({ editor: instance }) => {
      const doc = instance.getJSON();
      onChange(isEmptyDoc(doc) ? null : doc);
    },
  });

  // Dışarıdan gelen değer (ör. dil değişimi) düzenleyicideki içerikten farklıysa düzenleyici güncellenir.
  // Geliştirme kipinde efektler yeniden bağlanırken düzenleyici kapatılmış olabilir; kapalı düzenleyiciye yazılmaz.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const current = editor.getJSON();
    const next = value ?? EMPTY_DOC;
    if (JSON.stringify(current) !== JSON.stringify(next) && !(isEmptyDoc(current) && !value)) editor.commands.setContent(next, { emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    if (editor && !editor.isDestroyed) editor.setEditable(!disabled);
  }, [editor, disabled]);

  const state = useEditorState({
    editor,
    selector: ({ editor: instance }) => (instance ? {
      bold: instance.isActive("bold"),
      italic: instance.isActive("italic"),
      underline: instance.isActive("underline"),
      h2: instance.isActive("heading", { level: 2 }),
      h3: instance.isActive("heading", { level: 3 }),
      bullet: instance.isActive("bulletList"),
      ordered: instance.isActive("orderedList"),
      quote: instance.isActive("blockquote"),
      codeBlock: instance.isActive("codeBlock"),
      canUndo: instance.can().undo(),
      canRedo: instance.can().redo(),
    } : null),
  });
  const toolbarId = useId();

  if (!editor || !state) return <div className="rich_text_editor rich_text_editor_loading" aria-busy="true" />;
  const run = (command) => () => command(editor.chain().focus()).run();

  return (
    <div className={cx("rich_text_editor", disabled && "rich_text_editor_disabled", invalid && "rich_text_editor_invalid")}>
      {!disabled && (
        <div className="rich_text_editor_toolbar" role="toolbar" aria-label="Metin biçimi" id={toolbarId}>
          <ToolbarButton icon={FiBold} label="Kalın (Ctrl+B)" active={state.bold} onClick={run((chain) => chain.toggleBold())} />
          <ToolbarButton icon={FiItalic} label="İtalik (Ctrl+I)" active={state.italic} onClick={run((chain) => chain.toggleItalic())} />
          <ToolbarButton icon={FiUnderline} label="Altı çizili (Ctrl+U)" active={state.underline} onClick={run((chain) => chain.toggleUnderline())} />
          {allow.has("heading") && (
            <>
              <Button variant={state.h2 ? "soft" : "ghost"} size="sm" aria-pressed={state.h2} onClick={run((chain) => chain.toggleHeading({ level: 2 }))}>Başlık</Button>
              <Button variant={state.h3 ? "soft" : "ghost"} size="sm" aria-pressed={state.h3} onClick={run((chain) => chain.toggleHeading({ level: 3 }))}>Alt başlık</Button>
            </>
          )}
          {allow.has("list") && (
            <>
              <ToolbarButton icon={FiList} label="Madde işaretli liste" active={state.bullet} onClick={run((chain) => chain.toggleBulletList())} />
              <Button variant={state.ordered ? "soft" : "ghost"} size="sm" aria-pressed={state.ordered} ariaLabel="Numaralı liste" onClick={run((chain) => chain.toggleOrderedList())}>1.</Button>
            </>
          )}
          {allow.has("quote") && <ToolbarButton icon={FiMessageSquare} label="Alıntı" active={state.quote} onClick={run((chain) => chain.toggleBlockquote())} />}
          {allow.has("code") && <ToolbarButton icon={FiCode} label="Kod bloğu" active={state.codeBlock} onClick={run((chain) => chain.toggleCodeBlock())} />}
          {allow.has("link") && <LinkControl editor={editor} />}
          {allow.has("table") && <ToolbarButton icon={FiGrid} label="Tablo ekle" onClick={run((chain) => chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }))} />}
          <span className="rich_text_editor_spacer" />
          <ToolbarButton icon={FiRotateCcw} label="Geri al" disabled={!state.canUndo} onClick={run((chain) => chain.undo())} />
          <ToolbarButton icon={FiRotateCw} label="Yinele" disabled={!state.canRedo} onClick={run((chain) => chain.redo())} />
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
};

export default RichTextEditor;
