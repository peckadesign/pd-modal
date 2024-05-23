import React from 'jsx-dom'
import A11yDialog from 'a11y-dialog'
import { getFunction, isBodyOverflowing, isElementOverflowing, kebabize, TypedEventListener } from './utils'

export type PdModalOptions = {
	width: number
	className: string
	autoBind: boolean
	selector: string
	language: string
	template?: () => HTMLElement
	spinner?: Element
	i18n?: Record<string, I18nEntry>
}

export type I18nEntry = {
	close: string
	defaultTitle: string
	loading: string
}

export interface ContentLoader {
	classList?: string[]
	listeners?: ContentLoaderListener<keyof HTMLElementEventMap>[]
	matcher: (opener: PdModalOpener) => boolean
	isAsync: (opener: PdModalOpener) => boolean
	openContent: (opener: PdModalOpener) => boolean
	autoBind?: () => void
}

export type ContentLoaderListener<T extends keyof HTMLElementEventMap> = {
	eventName: T
	listener: (event: HTMLElementEventMap[T]) => void
}

const eventMapKeys: (keyof PdModalEventMap)[] = ['beforeOpen', 'afterOpen', 'load', 'beforeClose', 'afterClose']

export type PdModalListener = TypedEventListener<PdModal, PdModalEventMap[keyof PdModalEventMap]>

export type PdModalOpener = HTMLElement | SVGElement | null

export class PdModal extends EventTarget {
	private a11yDialog: A11yDialog
	private readonly a11yDialogCloserSelector = '[data-a11y-dialog-hide]'

	public readonly options: PdModalOptions

	public readonly placeholder: HTMLElement
	public readonly overlay: HTMLElement
	public readonly window: HTMLElement
	public readonly dialog: HTMLElement
	public readonly content: HTMLElement
	public readonly title: HTMLElement

	private opener: PdModalOpener = null
	private openerClassList: string[] = []
	private openerListeners: Partial<Record<keyof PdModalEventMap, PdModalListener[]>> = {}

	private loaderClassList: string[] = []
	private loaderListeners: ContentLoaderListener<keyof HTMLElementEventMap>[] = []

	private closers: Element[] = []

	private contentLoaders: ContentLoader[] = []

	private _isOpen = false
	private isBodyOverflowing = false

	public readonly i18n: Record<string, I18nEntry> = {
		en: { close: 'Close dialog', defaultTitle: 'Dialog window', loading: 'Loading content' },
		de: { close: 'Dialog schließen', defaultTitle: 'Dialogfenster', loading: 'Inhalt laden' },
		cs: { close: 'Zavřít dialogové okno', defaultTitle: 'Dialogové okno', loading: 'Načítání obsahu' },
		sk: { close: 'Zavrieť dialógové okno', defaultTitle: 'Dialógové okno', loading: 'Načítanie obsahu' }
	}

	private readonly defaults: PdModalOptions = {
		width: 900,
		className: '',
		autoBind: true,
		selector: '.js-modal',
		language: document.documentElement.lang || 'en'
	}

	public readonly element: HTMLElement

	constructor(options: Partial<PdModalOptions>) {
		super()

		options = options || {}
		this.options = { ...this.defaults, ...options }
		if (options.i18n) {
			this.i18n = { ...this.i18n, ...options.i18n }
		}

		if (!(this.options.language in this.i18n)) {
			this.options.language = 'en'
		}

		this.element = typeof options.template === 'function' ? options.template.call(this) : this.buildElement()

		if (this.options.className) {
			this.element.classList.add(...this.options.className.split(' '))
		}

		this.placeholder = document.getElementById('pdModal-placeholder') || document.body

		const overlay = this.element.querySelector<HTMLElement>('.pd-modal__overlay')
		const window = this.element.querySelector<HTMLElement>('.pd-modal__window')
		const dialog = this.element.querySelector<HTMLElement>('.pd-modal__dialog')
		const content = this.element.querySelector<HTMLElement>('.pd-modal__content')
		const title = this.element.querySelector<HTMLElement>('.pd-modal__title')

		if (overlay === null || window === null || dialog === null || content === null || title === null) {
			throw new Error(
				'Invalid modal template. Missing one of `.pd-modal__overlay`, `.pd-modal__window`, `.pd-modal__dialog`, `.pd-modal__content` or `.pd-modal__title` element.'
			)
		}

		this.a11yDialog = new A11yDialog(this.element)

		this.overlay = overlay
		this.window = window
		this.dialog = dialog
		this.content = content
		this.title = title

		this.addEventListener('afterOpen', this.checkScrollbars.bind(this))

		this.addEventListener('load', this.checkScrollbars.bind(this))
		this.addEventListener('load', this.addClosersFromContent.bind(this))
		this.addEventListener('load', () => {
			delete this.element.dataset.modalLoading
			delete this.element.dataset.modalEmpty
		})

		this.a11yDialog.on('hide', (node, event) => this.dialogOnHide(event))

		this.window.addEventListener('click', this.delegateWindowClick.bind(this))
	}

	public registerContentLoader(contentLoader: ContentLoader): ContentLoader {
		this.contentLoaders.push(contentLoader)

		if (this.options.autoBind && contentLoader.autoBind) {
			contentLoader.autoBind()
		}

		return contentLoader
	}

	public open(opener: PdModalOpener, event?: Event): void {
		this.opener = opener

		const contentLoader = this.matchContentLoader(opener)
		const isAsyncContent = contentLoader.isAsync(opener)
		const alreadyOpen = this.isOpen
		const scrollTop = document.scrollingElement?.scrollTop
		let loaded = false

		if (alreadyOpen) {
			this.removeClosersFromContent()

			// Keep the focus inside modal when changing content
			this.element.focus()

			// Restore scroll position of document. When modal is focused, browser tries to scroll to it, even though it
			// has fixed position. So after focus is moved to it, we immediately set the `scrollTop` to previously
			// stored value.
			if (scrollTop) {
				document.scrollingElement!.scrollTop = scrollTop
			}
		}

		if (!alreadyOpen) {
			this.dispatchEvent(new CustomEvent('beforeOpen', { detail: { opener, event } }))

			this.isBodyOverflowing = isBodyOverflowing()
			this._isOpen = true
		}

		if (!this.element.isConnected) {
			this.placeholder.insertAdjacentElement('afterbegin', this.element)
		}

		// Immediately set options only if either content is static (non ajax link is being loaded) or if the modal
		// hasn't been opened yet. If the content is async loaded and modal has already been opened, the options should
		// be set manually after the content has been loaded.
		//
		// Same applies to loading the content. If it is static content, we want to open it. Otherwise, we keep the
		// current content and let ajax library to replace it. We don't want to change the content to default spinner.
		//
		// If the content is static and modal is already opened, we remove old listeners first.
		if (!isAsyncContent && alreadyOpen) {
			this.removeListenersFromOpener()
		}

		if (!isAsyncContent || !alreadyOpen) {
			this.setOptionsFromOpener()
			this.setOptionsFromContentLoader(contentLoader)
			loaded = contentLoader.openContent(opener)
		}

		if (!loaded) {
			this.element.dataset.modalLoading = 'true'
		}

		if (!loaded && isAsyncContent && !alreadyOpen) {
			this.element.dataset.modalEmpty = 'true'
		}

		if (!alreadyOpen) {
			this.a11yDialog.show(event)
			document.documentElement.dataset.modalOpen = 'true'

			// Same as above when `this.element.focus()` is called (a11yDialog `show` method focuses the element as
			// well).
			if (scrollTop) {
				document.scrollingElement!.scrollTop = scrollTop
			}

			this.dispatchEvent(new CustomEvent('afterOpen', { detail: { opener, event } }))
		}

		if (loaded) {
			this.dispatchLoadEvent(opener, event, this.content.innerHTML)
		}
	}

	// Public method for invoking closing. Only calls a11yDialog hide method.
	public close(event?: Event): void {
		this.a11yDialog.hide(event)
	}

	// Callback method after dialog has closed. This is where we can do our own stuff and cleanup.
	private dialogOnHide(event?: Event): void {
		if (!this._isOpen) {
			return
		}

		const opener = this.opener

		this.dispatchEvent(new CustomEvent('beforeClose', { detail: { opener, event } }))

		this.element.dataset.modalClosing = 'true'
		this._isOpen = false
		this.opener = null

		const closingDuration = parseInt(
			getComputedStyle(this.element).getPropertyValue('--pd-modal-closing-duration') || '0'
		)

		setTimeout(() => {
			this.placeholder.removeChild(this.element)

			delete document.documentElement.dataset.modalOpen
			delete document.documentElement.dataset.modalScrollbarOffset

			delete this.element.dataset.modalClosing

			this.dispatchEvent(new CustomEvent('afterClose', { detail: { opener, event } }))

			this.removeOptionsFromOpener()
			this.removeOptionsFromContentLoader()
			this.resetContent()
		}, closingDuration)
	}

	private matchContentLoader(opener: PdModalOpener): ContentLoader {
		const matchedContentLoader = this.contentLoaders.find((contentLoader) => contentLoader.matcher(opener))

		if (!matchedContentLoader) {
			throw new Error(`PdModal: No content loader matched for opener element.`)
		}

		return matchedContentLoader
	}

	public setModaltitle(title?: string): void {
		if (title) {
			this.title.innerHTML = title
			this.title.hidden = false
		} else {
			// Default heading, only for screen reader purposes, therefore hidden with `hidden` attribute
			this.title.innerHTML = this.i18n[this.options.language].defaultTitle
			this.title.hidden = true
			console.warn("PdModal: Missing modal title, assistive technologies won't be happy 😢")
		}
	}

	private resetContent(): void {
		this.title.innerHTML = this.i18n[this.options.language].defaultTitle
		this.title.hidden = true
		this.content.replaceChildren()
	}

	public get isOpen(): boolean {
		return this._isOpen
	}

	private buildElement(): HTMLElement {
		const i18n = this.i18n[this.options.language]

		return (
			<div class="pd-modal" id="pdModal" aria-hidden="true" aria-labelledby="pdModalTitle">
				<div class="pd-modal__overlay" data-a11y-dialog-hide={true}></div>
				<div class="pd-modal__window" role="document">
					<div class="pd-modal__dialog">
						<header class="pd-modal__header">
							<button type="button" data-a11y-dialog-hide={true} class="pd-modal__close" aria-label={i18n.close}>
								{i18n.close}
							</button>

							<h1 class="pd-modal__title" id="pdModalTitle">
								{i18n.defaultTitle}
							</h1>
						</header>

						<div class="pd-modal__content"></div>
					</div>
				</div>
			</div>
		) as HTMLElement
	}

	public setOptionsFromOpener(): void {
		if (!this.opener) {
			return
		}

		this.setWidthFromOpener()
		this.setClassListFromOpener()
		this.setListenersFromOpener()
	}

	private setWidthFromOpener(): void {
		const width = this.opener?.getAttribute('data-modal-width')
		if (width) {
			this.dialog.style.maxWidth = `${width}px`
		}
	}

	private setClassListFromOpener(): void {
		const classList = this.opener?.getAttribute('data-modal-class-name')

		// Undefined or null when no opener → we don't make any changes to class list.
		if (classList === undefined || classList === null) {
			return
		}

		const classListArray = classList !== '' ? classList.split(' ') : []

		// If the data attribute has been passed & there are old classes, we want to replace classes on window,
		// therefore remove the old classes first.
		if (this.openerClassList.length) {
			this.element.classList.remove(...this.openerClassList)
		}

		// Apply new classes from opener
		if (classListArray.length) {
			this.openerClassList = classListArray
			this.element.classList.add(...classListArray)
		}
	}

	private setListenersFromOpener(): void {
		eventMapKeys.forEach((eventName) => {
			const listeners = this.getOpenerListeners(eventName)

			if (listeners.length) {
				this.openerListeners[eventName] = listeners
			}

			listeners.forEach((listener) => {
				this.addEventListener(eventName, listener)
			})
		})
	}

	public removeOptionsFromOpener(): void {
		this.dialog.style.removeProperty('max-width')

		this.element.classList.remove(...this.openerClassList)
		this.openerClassList = []

		this.removeListenersFromOpener()
	}

	public removeListenersFromOpener(): void {
		for (const eventName in this.openerListeners) {
			this.openerListeners[eventName as keyof PdModalEventMap]?.forEach((listener) => {
				this.removeEventListener(eventName, listener)
			})
		}
		this.openerListeners = {}
	}

	private getOpenerListeners(eventName: keyof PdModalEventMap): PdModalListener[] {
		const callbackNames = this.opener?.getAttribute(this.getEventDataAttributeName(eventName))?.split(' ') || []
		const listeners: PdModalListener[] = []

		callbackNames.forEach((callbackName) => {
			const callback = getFunction(callbackName, window)

			if (typeof callback === 'function') {
				listeners.push(callback)
			}
		})

		return listeners
	}

	private setOptionsFromContentLoader(contentLoader: ContentLoader): void {
		this.setClassListFromContentLoader(contentLoader)
		this.setListenersFromContentLoader(contentLoader)
	}

	private setClassListFromContentLoader(contentLoader: ContentLoader): void {
		this.removeClassListFromPreviousContentLoader()

		if (contentLoader.classList) {
			this.loaderClassList = contentLoader.classList
			this.element.classList.add(...contentLoader.classList)
		}
	}

	private setListenersFromContentLoader(contentLoader: ContentLoader): void {
		this.removeListenersFromPreviousContentLoader()

		contentLoader.listeners?.forEach((contentLoaderListener) => {
			this.element.addEventListener(contentLoaderListener.eventName, contentLoaderListener.listener)
			this.loaderListeners.push(contentLoaderListener)
		})
	}

	private removeOptionsFromContentLoader(): void {
		this.removeClassListFromPreviousContentLoader()
		this.removeListenersFromPreviousContentLoader()
	}

	private removeClassListFromPreviousContentLoader(): void {
		this.element.classList.remove(...this.loaderClassList)
	}

	private removeListenersFromPreviousContentLoader(): void {
		this.loaderListeners.forEach((contentLoaderListener) => {
			this.element.removeEventListener(contentLoaderListener.eventName, contentLoaderListener.listener)
		})
	}

	private delegateWindowClick(event: Event): void {
		if (event.target === this.window) {
			this.overlay.click()
		}
	}

	private getEventDataAttributeName(eventName: keyof PdModalEventMap): string {
		return `data-modal-${kebabize(eventName)}`
	}

	private addClosersFromContent(): void {
		this.closers = Array.from(this.content.querySelectorAll<Element>(this.a11yDialogCloserSelector))

		this.closers.forEach((closer) => {
			closer.addEventListener('click', this.handleCloserClick.bind(this))
		})
	}

	private removeClosersFromContent(): void {
		this.closers.forEach((closer) => {
			closer.removeEventListener('click', this.handleCloserClick.bind(this))
		})

		this.closers = []
	}

	private handleCloserClick(event: Event): void {
		event.preventDefault()
		this.close(event)
	}

	private checkScrollbars() {
		if (this.isBodyOverflowing) {
			document.documentElement.dataset.modalScrollbarOffset = 'true'
		} else {
			if (isElementOverflowing(this.window)) {
				this.window.dataset.modalScrollbarOffset = 'true'
			} else {
				delete this.window.dataset.modalScrollbarOffset
			}
		}
	}

	public dispatchLoadEvent(opener: PdModalOpener, event?: Event, content?: string): void {
		this.dispatchEvent(new CustomEvent('load', { detail: { opener, event, content } }))
	}

	public declare addEventListener: <K extends keyof PdModalEventMap | string>(
		type: K,
		listener: TypedEventListener<PdModal, K extends keyof PdModalEventMap ? PdModalEventMap[K] : CustomEvent>,
		options?: boolean | AddEventListenerOptions
	) => void
	public declare removeEventListener: <K extends keyof PdModalEventMap | string>(
		type: K,
		listener: TypedEventListener<PdModal, K extends keyof PdModalEventMap ? PdModalEventMap[K] : CustomEvent>,
		options?: boolean | AddEventListenerOptions
	) => void
}

export type BeforeOpenEvent = CustomEvent<{ opener: PdModalOpener; event?: Event | CustomEvent }>
export type AfterOpenEvent = CustomEvent<{ opener: PdModalOpener; event?: Event | CustomEvent }>
export type LoadEvent = CustomEvent<{ opener: PdModalOpener; event?: Event | CustomEvent; content?: string }>
export type BeforeCloseEvent = CustomEvent<{ opener: PdModalOpener; event?: Event | CustomEvent }>
export type AfterCloseEvent = CustomEvent<{ opener: PdModalOpener; event?: Event | CustomEvent }>

interface PdModalEventMap {
	beforeOpen: BeforeOpenEvent
	afterOpen: AfterOpenEvent
	load: LoadEvent
	beforeClose: BeforeCloseEvent
	afterClose: AfterCloseEvent
}
