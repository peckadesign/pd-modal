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
