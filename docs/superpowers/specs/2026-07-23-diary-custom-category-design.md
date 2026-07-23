# Study Diary Custom Category Design

## Goal

Allow people to choose an existing category or enter their own category in both
the Write Diary and Edit Diary forms. A category introduced by one entry should
remain available when writing or editing later entries.

## Interaction

Replace the fixed Category `<select>` with an editable combobox backed by a
suggestion list.

- The field starts with the existing built-in categories as suggestions.
- People may select a suggestion or type a new category.
- Saving an entry makes its category available as a suggestion in later Write
  and Edit sessions.
- Edit pre-fills the entry's current category and allows it to be replaced.
- The field is required. Leading and trailing whitespace is removed before
  validation and persistence.

The browser's native input and datalist behavior will provide keyboard entry,
selection, and suggestion filtering without adding a custom popup component.

## Category Source and Deduplication

Suggestions are rebuilt from two sources:

1. The current built-in category list.
2. Category values on all loaded diary entries.

The built-in spelling wins when an entry differs from a built-in category only
by letter case. Other duplicates are compared case-insensitively and retain the
first non-empty spelling encountered. No separate category table or browser
storage is introduced: diary entries remain the source of truth for custom
categories.

## Data Flow

When the form opens, the category suggestions reflect the current in-memory
entries. When Edit opens, its category value is assigned to the editable input.
On submit, the trimmed category value is required and passed through the
existing insert or update path. After a successful insert or update, the
suggestion list is refreshed from the updated entries.

If an entry is later removed and no remaining entry uses its custom category,
that category naturally disappears the next time suggestions are rebuilt.

## Error Handling

- Empty or whitespace-only category values prevent submission.
- Existing backend errors continue to appear in the form's current error area.
- Old entries and built-in categories require no migration.

## Testing

Automated tests will cover:

- merging built-in and entry-derived categories;
- trimming empty values;
- case-insensitive deduplication with stable display spelling;
- preserving arbitrary custom category text through insert and edit payloads.

Browser verification will cover Write and Edit field behavior, suggestion
availability after save, and correct pre-filling of an existing custom category.

