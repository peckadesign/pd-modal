# pd-modal

## Quick start
```
$ npm install @peckadesign/pd-modal
```

```typescript
import { PdModal, HTMLContentLoader } from '@peckadesign/pd-modal'

const modal = new PdModal()
modal.registerContentLoader(new HTMLContentLoader())
```

This code will create instance of a modal window. The content itself is loaded using content loaders. This allows you to import only loaders you actually need in your project.

When `HTMLContentLoader` is registered, the modal is automatically binded to link elements with `class="js-modal"` by default. For more in-depth info and complete documentation, please see [example](/example/index.html).

## HTML in the modal title and media caption

The modal title (`data-modal-title`, or the `alt` of a nested image) and the media caption in `MediaGalleryContentLoader` (`data-modal-description`, or the `title` of a nested image) are rendered as HTML, so they can contain formatting. Both are read from the opener element, i.e. from the same document as the modal itself, and are therefore inserted as-is.

If these values carry data you do not control, pass a `sanitizer` function. It receives the HTML string and its return value is inserted into the modal.

```typescript
const modal = new PdModal({
	sanitizer: (html) => DOMPurify.sanitize(html)
})
```
