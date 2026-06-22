"use client";

import { ChangeEvent, ClipboardEvent, DragEvent, ReactNode, useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import CharacterCount from "@tiptap/extension-character-count";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import SubscriptExtension from "@tiptap/extension-subscript";
import SuperscriptExtension from "@tiptap/extension-superscript";
import Table from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import TextAlign from "@tiptap/extension-text-align";
import TextStyle from "@tiptap/extension-text-style";
import UnderlineExtension from "@tiptap/extension-underline";
import Youtube from "@tiptap/extension-youtube";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code2,
  CodeXml,
  Columns3,
  Eraser,
  Heading1,
  Highlighter,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Maximize2,
  Minimize2,
  Minus,
  Pilcrow,
  Quote,
  Redo2,
  Rows3,
  Strikethrough,
  Subscript,
  Superscript,
  Table2,
  Trash2,
  Underline,
  Undo2,
  Unlink,
  YoutubeIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  onBlur?: () => void;
  onUploadImage?: (file: File) => Promise<string>;
  placeholder?: string;
  minHeight?: number;
  disabled?: boolean;
};

type ToolbarButtonProps = {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
};

function ToolbarButton({ label, active, disabled, onClick, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-transparent text-textSecondary transition hover:border-border hover:bg-elevated hover:text-textPrimary disabled:cursor-not-allowed disabled:opacity-35",
        active && "border-primary/40 bg-primary/15 text-primary",
      )}
    >
      {children}
    </button>
  );
}

function normalizeExternalURL(value: string) {
  const trimmed = value.trim();
  if (!trimmed || /^(https?:|mailto:|tel:|\/)/i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

export function RichTextEditor({
  value,
  onChange,
  onBlur,
  onUploadImage,
  placeholder = "Start writing...",
  minHeight = 280,
  disabled = false,
}: RichTextEditorProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  const onBlurRef = useRef(onBlur);
  const [sourceMode, setSourceMode] = useState(false);
  const [sourceValue, setSourceValue] = useState(value);
  const [fullscreen, setFullscreen] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState("");

  useEffect(() => {
    onChangeRef.current = onChange;
    onBlurRef.current = onBlur;
  }, [onBlur, onChange]);

  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4] } }),
      UnderlineExtension,
      SubscriptExtension,
      SuperscriptExtension,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
      }),
      Image.configure({ allowBase64: false, inline: false }),
      Youtube.configure({ controls: true, nocookie: true, modestBranding: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder }),
      CharacterCount,
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class: "rich-content min-w-0 px-4 py-4 text-sm text-textSecondary outline-none",
        spellcheck: "true",
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      const html = currentEditor.getHTML();
      setSourceValue(html);
      onChangeRef.current(html);
    },
    onBlur: () => onBlurRef.current?.(),
  });

  useEffect(() => {
    if (!editor) {
      return;
    }
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    if (!editor || sourceMode) {
      return;
    }
    const nextValue = value || "";
    if (nextValue !== editor.getHTML() && !(nextValue === "" && editor.isEmpty)) {
      editor.commands.setContent(nextValue, false);
      setSourceValue(nextValue);
    }
  }, [editor, sourceMode, value]);

  if (!editor) {
    return <div className="h-72 animate-pulse rounded-lg border border-border bg-elevated" />;
  }

  const setLink = () => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const entered = window.prompt("Link URL", previous ?? "https://");
    if (entered === null) {
      return;
    }
    const href = normalizeExternalURL(entered);
    if (!href) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
  };

  const addImageURL = () => {
    const entered = window.prompt("Image URL", "https://");
    if (!entered) {
      return;
    }
    editor.chain().focus().setImage({ src: normalizeExternalURL(entered) }).run();
  };

  const addYoutube = () => {
    const entered = window.prompt("YouTube video URL", "https://www.youtube.com/watch?v=");
    if (!entered) {
      return;
    }
    editor.commands.setYoutubeVideo({ src: normalizeExternalURL(entered), width: 640, height: 360 });
  };

  const uploadAndInsertImage = async (file: File) => {
    if (!onUploadImage) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      setUploadError("Choose a JPG, PNG, GIF, or WEBP image.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("Editor images must be 10 MB or smaller.");
      return;
    }
    setUploadingImage(true);
    setUploadError("");
    try {
      const src = await onUploadImage(file);
      editor.chain().focus().setImage({ src, alt: file.name }).run();
    } catch {
      setUploadError("Could not upload this image.");
    } finally {
      setUploadingImage(false);
    }
  };

  const uploadImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) {
      await uploadAndInsertImage(file);
    }
  };

  const pasteImage = (event: ClipboardEvent<HTMLDivElement>) => {
    const file = Array.from(event.clipboardData.files).find((item) => item.type.startsWith("image/"));
    if (!file || !onUploadImage) {
      return;
    }
    event.preventDefault();
    void uploadAndInsertImage(file);
  };

  const dropImage = (event: DragEvent<HTMLDivElement>) => {
    const file = Array.from(event.dataTransfer.files).find((item) => item.type.startsWith("image/"));
    if (!file || !onUploadImage) {
      return;
    }
    event.preventDefault();
    void uploadAndInsertImage(file);
  };

  const toggleSourceMode = () => {
    if (sourceMode) {
      editor.commands.setContent(sourceValue || "", false);
      onChangeRef.current(editor.getHTML());
      setSourceValue(editor.getHTML());
    } else {
      setSourceValue(editor.getHTML());
    }
    setSourceMode((current) => !current);
  };

  const characterCount = sourceMode
    ? sourceValue.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().length
    : editor.storage.characterCount.characters();
  const wordCount = sourceMode
    ? sourceValue.replace(/<[^>]*>/g, " ").trim().split(/\s+/).filter(Boolean).length
    : editor.storage.characterCount.words();

  return (
    <div className={cn("rich-text-editor overflow-hidden rounded-lg border border-border bg-elevated focus-within:border-primary/60", fullscreen && "fixed inset-3 z-[100] flex flex-col bg-background shadow-2xl sm:inset-6")}>
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-black/25 p-2">
        <select
          title="Text style"
          aria-label="Text style"
          value={editor.isActive("heading", { level: 1 }) ? "h1" : editor.isActive("heading", { level: 2 }) ? "h2" : editor.isActive("heading", { level: 3 }) ? "h3" : editor.isActive("heading", { level: 4 }) ? "h4" : "p"}
          onChange={(event) => {
            const selected = event.target.value;
            if (selected === "p") editor.chain().focus().setParagraph().run();
            else editor.chain().focus().toggleHeading({ level: Number(selected.slice(1)) as 1 | 2 | 3 | 4 }).run();
          }}
          disabled={disabled || sourceMode}
          className="h-8 rounded-md border border-border bg-elevated px-2 text-xs text-textSecondary outline-none"
        >
          <option value="p">Paragraph</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
          <option value="h4">Heading 4</option>
        </select>

        <span className="mx-1 h-6 w-px bg-white/10" />
        <ToolbarButton label="Bold" active={editor.isActive("bold")} disabled={disabled || sourceMode} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="size-4" /></ToolbarButton>
        <ToolbarButton label="Italic" active={editor.isActive("italic")} disabled={disabled || sourceMode} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="size-4" /></ToolbarButton>
        <ToolbarButton label="Underline" active={editor.isActive("underline")} disabled={disabled || sourceMode} onClick={() => editor.chain().focus().toggleUnderline().run()}><Underline className="size-4" /></ToolbarButton>
        <ToolbarButton label="Strikethrough" active={editor.isActive("strike")} disabled={disabled || sourceMode} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className="size-4" /></ToolbarButton>
        <ToolbarButton label="Inline code" active={editor.isActive("code")} disabled={disabled || sourceMode} onClick={() => editor.chain().focus().toggleCode().run()}><Code2 className="size-4" /></ToolbarButton>
        <ToolbarButton label="Subscript" active={editor.isActive("subscript")} disabled={disabled || sourceMode} onClick={() => editor.chain().focus().toggleSubscript().run()}><Subscript className="size-4" /></ToolbarButton>
        <ToolbarButton label="Superscript" active={editor.isActive("superscript")} disabled={disabled || sourceMode} onClick={() => editor.chain().focus().toggleSuperscript().run()}><Superscript className="size-4" /></ToolbarButton>

        <label title="Text color" className="relative inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-textSecondary hover:bg-elevated hover:text-textPrimary">
          <span className="sr-only">Text color</span><Heading1 className="size-4" />
          <span className="absolute bottom-1 h-0.5 w-4 rounded" style={{ backgroundColor: editor.getAttributes("textStyle").color || "#f9fafb" }} />
          <input type="color" disabled={disabled || sourceMode} value={editor.getAttributes("textStyle").color || "#f9fafb"} onChange={(event) => editor.chain().focus().setColor(event.target.value).run()} className="absolute inset-0 cursor-pointer opacity-0" />
        </label>
        <label title="Highlight color" className="relative inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-textSecondary hover:bg-elevated hover:text-textPrimary">
          <span className="sr-only">Highlight color</span><Highlighter className="size-4" />
          <input type="color" disabled={disabled || sourceMode} value={editor.getAttributes("highlight").color || "#f59e0b"} onChange={(event) => editor.chain().focus().setHighlight({ color: event.target.value }).run()} className="absolute inset-0 cursor-pointer opacity-0" />
        </label>

        <span className="mx-1 h-6 w-px bg-white/10" />
        <ToolbarButton label="Bullet list" active={editor.isActive("bulletList")} disabled={disabled || sourceMode} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="size-4" /></ToolbarButton>
        <ToolbarButton label="Numbered list" active={editor.isActive("orderedList")} disabled={disabled || sourceMode} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="size-4" /></ToolbarButton>
        <ToolbarButton label="Block quote" active={editor.isActive("blockquote")} disabled={disabled || sourceMode} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="size-4" /></ToolbarButton>
        <ToolbarButton label="Code block" active={editor.isActive("codeBlock")} disabled={disabled || sourceMode} onClick={() => editor.chain().focus().toggleCodeBlock().run()}><CodeXml className="size-4" /></ToolbarButton>
        <ToolbarButton label="Horizontal rule" disabled={disabled || sourceMode} onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus className="size-4" /></ToolbarButton>

        <span className="mx-1 h-6 w-px bg-white/10" />
        <ToolbarButton label="Align left" active={editor.isActive({ textAlign: "left" })} disabled={disabled || sourceMode} onClick={() => editor.chain().focus().setTextAlign("left").run()}><AlignLeft className="size-4" /></ToolbarButton>
        <ToolbarButton label="Align center" active={editor.isActive({ textAlign: "center" })} disabled={disabled || sourceMode} onClick={() => editor.chain().focus().setTextAlign("center").run()}><AlignCenter className="size-4" /></ToolbarButton>
        <ToolbarButton label="Align right" active={editor.isActive({ textAlign: "right" })} disabled={disabled || sourceMode} onClick={() => editor.chain().focus().setTextAlign("right").run()}><AlignRight className="size-4" /></ToolbarButton>
        <ToolbarButton label="Justify" active={editor.isActive({ textAlign: "justify" })} disabled={disabled || sourceMode} onClick={() => editor.chain().focus().setTextAlign("justify").run()}><AlignJustify className="size-4" /></ToolbarButton>

        <span className="mx-1 h-6 w-px bg-white/10" />
        <ToolbarButton label="Add or edit link" active={editor.isActive("link")} disabled={disabled || sourceMode} onClick={setLink}><Link2 className="size-4" /></ToolbarButton>
        <ToolbarButton label="Remove link" disabled={disabled || sourceMode || !editor.isActive("link")} onClick={() => editor.chain().focus().unsetLink().run()}><Unlink className="size-4" /></ToolbarButton>
        {onUploadImage ? (
          <ToolbarButton label="Upload image" disabled={disabled || sourceMode || uploadingImage} onClick={() => imageInputRef.current?.click()}>{uploadingImage ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}</ToolbarButton>
        ) : null}
        <ToolbarButton label="Insert image from URL" disabled={disabled || sourceMode} onClick={addImageURL}><ImagePlus className="size-4" /></ToolbarButton>
        <ToolbarButton label="Embed YouTube video" disabled={disabled || sourceMode} onClick={addYoutube}><YoutubeIcon className="size-4" /></ToolbarButton>
        <ToolbarButton label="Insert table" disabled={disabled || sourceMode} onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Table2 className="size-4" /></ToolbarButton>

        {editor.isActive("table") ? (
          <>
            <ToolbarButton label="Add row" disabled={disabled || sourceMode} onClick={() => editor.chain().focus().addRowAfter().run()}><Rows3 className="size-4" /></ToolbarButton>
            <ToolbarButton label="Add column" disabled={disabled || sourceMode} onClick={() => editor.chain().focus().addColumnAfter().run()}><Columns3 className="size-4" /></ToolbarButton>
            <ToolbarButton label="Delete table" disabled={disabled || sourceMode} onClick={() => editor.chain().focus().deleteTable().run()}><Trash2 className="size-4" /></ToolbarButton>
          </>
        ) : null}

        <span className="mx-1 h-6 w-px bg-white/10" />
        <ToolbarButton label="Clear formatting" disabled={disabled || sourceMode} onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}><Eraser className="size-4" /></ToolbarButton>
        <ToolbarButton label="Undo" disabled={disabled || sourceMode || !editor.can().chain().focus().undo().run()} onClick={() => editor.chain().focus().undo().run()}><Undo2 className="size-4" /></ToolbarButton>
        <ToolbarButton label="Redo" disabled={disabled || sourceMode || !editor.can().chain().focus().redo().run()} onClick={() => editor.chain().focus().redo().run()}><Redo2 className="size-4" /></ToolbarButton>
        <ToolbarButton label={sourceMode ? "Return to visual editor" : "Edit HTML source"} active={sourceMode} disabled={disabled} onClick={toggleSourceMode}>{sourceMode ? <Pilcrow className="size-4" /> : <CodeXml className="size-4" />}</ToolbarButton>
        <ToolbarButton label={fullscreen ? "Exit fullscreen" : "Fullscreen"} active={fullscreen} onClick={() => setFullscreen((current) => !current)}>{fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}</ToolbarButton>
        <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={uploadImage} className="sr-only" />
      </div>

      <div className={cn("rich-text-editor__content overflow-y-auto", fullscreen && "min-h-0 flex-1")} style={{ minHeight, maxHeight: fullscreen ? "none" : 720 }}>
        {sourceMode ? (
          <textarea
            value={sourceValue}
            onChange={(event) => {
              setSourceValue(event.target.value);
              onChangeRef.current(event.target.value);
            }}
            onBlur={() => onBlurRef.current?.()}
            disabled={disabled}
            spellCheck={false}
            aria-label="HTML source"
            className="min-h-full w-full resize-y bg-transparent px-4 py-4 font-mono text-sm leading-6 text-textSecondary outline-none"
            style={{ minHeight }}
          />
        ) : (
          <div onPasteCapture={pasteImage} onDropCapture={dropImage}>
            <EditorContent editor={editor} />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-surface px-3 py-2 text-[11px] text-textSecondary">
        <span>{sourceMode ? "HTML source" : "Visual editor"}</span>
        <span>{wordCount.toLocaleString()} words · {characterCount.toLocaleString()} characters</span>
      </div>
      {uploadError ? <p className="border-t border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">{uploadError}</p> : null}
    </div>
  );
}
