import React from 'jsx-dom'
import A11yDialog from 'a11y-dialog'
import { getFunction, isBodyOverflowing, isElementOverflowing, kebabize, TypedEventListener } from './utils'

export interface PdModalOptions {
	width: number
	className: string
	autoBind: boolean
	selector: string
	language: string
	template?: () => HTMLElement
	spinner?: Element | string
	i18n?: Record<string, I18nEntry>
}

export interface I18nEntry {
	close: string
	defaultTitle: string
	loading: string
}

const eventMapKeys: (keyof PdModalEventMap)[] = ['beforeOpen', 'afterOpen', 'load', 'beforeClose', 'afterClose']

type PdModalListener = TypedEventListener<PdModal, PdModalEventMap[keyof PdModalEventMap]>

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

	private opener: HTMLElement | SVGElement | null = null
	private openerClassList: string[] = []
	private openerListeners: Partial<Record<keyof PdModalEventMap, PdModalListener[]>> = {}

	private closers: Element[] = []

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
		this.addEventListener('load', () => delete this.element.dataset.modalLoading)

		this.a11yDialog.on('hide', (node, event) => this.dialogOnHide(event))

		this.window.addEventListener('click', this.delegateWindowClick.bind(this))

		if (this.options.autoBind) {
			this.autoBind()
		}
	}

	private autoBind(): void {
		document.addEventListener('click', (event) => {
			const targetNew = event.button || event.ctrlKey || event.shiftKey || event.altKey || event.metaKey
			const element = event.target as Element
			let opener = null

			if (element && element.matches(this.options.selector)) {
				opener = element as HTMLElement | SVGElement
			} else {
				opener = element.closest<HTMLElement | SVGElement>(this.options.selector)
			}

			if (opener && (this.getHash(opener) || !targetNew)) {
				event.preventDefault()
				this.open(opener, event)
			}
		})
	}

	public open(opener: HTMLElement | SVGElement | null, event?: Event): void {
		this.opener = opener

		const alreadyOpen = this.isOpen
		const isStaticContent = this.isStaticContent()
		let loaded = false

		if (alreadyOpen) {
			this.removeClosersFromContent()
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
		// hasn't been opened yet. If the content is ajax loaded and modal has already been opened, the options should
		// be set manually after the content has been loaded.
		//
		// Same applies to loading the content. If it is static content, we want to open it. Otherwise, we keep the
		// current content and let ajax library to replace it. We don't want to change the content to default spinner.
		//
		// If the content is static and modal is already opened, we remove old listeners first.
		if (isStaticContent && alreadyOpen) {
			this.removeListenersFromOpener()
		}

		if (isStaticContent || !alreadyOpen) {
			this.setOptionsFromOpener()
			loaded = this.openContent()
		}

		if (!alreadyOpen) {
			const scrollTop = document.scrollingElement?.scrollTop

			this.a11yDialog.show(event)
			document.documentElement.dataset.modalOpen = 'true'

			// Restore scroll position of document. When modal is focused, browser tries to scroll to it, even thoug it
			// has fixed position. So after focus is moved to it (a11yDialog `show` method), we immediately set the
			// scrollTop to previously stored value.
			if (scrollTop) {
				document.scrollingElement!.scrollTop = scrollTop
			}

			this.dispatchEvent(new CustomEvent('afterOpen', { detail: { opener, event } }))
		}

		if (loaded) {
			this.dispatchEvent(new CustomEvent('load', { detail: { opener, event, content: this.content.innerHTML } }))
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
		}, closingDuration)
	}

	/**
	 * @return boolean  Returns if the content is already loaded or not. In case of AJAX returns false, otherwise true.
	 */
	private openContent(): boolean {
		let hash: string | undefined

		if (this.opener && (hash = this.getHash(this.opener))) {
			this.openHtml(this.opener, hash)
			return true
		} else {
			this.openAjax()
			return false
		}
	}

	private isStaticContent(): boolean {
		return this.opener !== null && this.getHash(this.opener) !== undefined
	}

	private openHtml(opener: HTMLElement | SVGElement, hash: string): void {
		const contentElement: HTMLElement | null = document.getElementById(hash)

		if (contentElement) {
			this.content.innerHTML = contentElement.innerHTML
		}

		const heading = this.getModalTitle(opener)

		if (heading) {
			this.title.innerHTML = heading
			this.title.hidden = false
		} else {
			// Default heading, only for screen reader purposes, therefore hidden with `hidden` attribute
			this.title.innerHTML = this.i18n[this.options.language].defaultTitle
			this.title.hidden = true
			console.warn("Missing modal title, assistive technologies won't be happy 😢")
		}
	}

	private openAjax(): void {
		this.element.dataset.modalLoading = 'true'

		if (typeof this.options.spinner === 'string') {
			this.content.innerHTML = this.options.spinner
		} else if (this.options.spinner && this.options.spinner instanceof Element) {
			this.content.innerHTML = ''
			this.content.appendChild(this.options.spinner)
		}

		this.title.innerHTML = this.i18n[this.options.language].loading
	}

	public get isOpen(): boolean {
		return this._isOpen
	}

	private buildElement(): HTMLElement {
		const i18n = this.i18n[this.options.language]

		return (
			<div class="pd-modal" id="pdModal" aria-hidden="true" aria-labelledby="snippet--pdModalTitle">
				<div class="pd-modal__overlay" data-a11y-dialog-hide={true}></div>
				<div class="pd-modal__window" role="document">
					<div class="pd-modal__dialog">
						<header class="pd-modal__header">
							<button type="button" data-a11y-dialog-hide={true} class="pd-modal__close" aria-label={i18n.close}>
								{i18n.close}
							</button>

							<h1 class="pd-modal__title" id="snippet--pdModalTitle">
								{i18n.defaultTitle}
							</h1>
						</header>

						<div class="pd-modal__content" id="snippet--pdModal"></div>
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
			this.window.classList.remove(...this.openerClassList)
		}

		// Apply new classes from opener
		if (classListArray.length) {
			this.openerClassList = classListArray
			this.window.classList.add(...classListArray)
		}
	}

	public removeOptionsFromOpener(): void {
		this.dialog.style.removeProperty('max-width')

		this.window.classList.remove(...this.openerClassList)
		this.openerClassList = []

		this.removeListenersFromOpener()
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

	private delegateWindowClick(event: Event): void {
		if (event.target === this.window) {
			this.overlay.click()
		}
	}

	private getEventDataAttributeName(eventName: keyof PdModalEventMap): string {
		return `data-modal-${kebabize(eventName)}`
	}

	private getModalTitle(opener: HTMLElement | SVGElement): string | undefined {
		let heading = opener.dataset.modalTitle

		if (!heading) {
			const headingElement = this.content.querySelector<HTMLElement>('[data-modal-title], h1, h2, h3, h4, h5, h6')
			heading = headingElement?.innerHTML
		}

		return heading
	}

	private getHash(opener: HTMLElement | SVGElement): string | undefined {
		if (opener.dataset.modalHash) {
			return opener.dataset.modalHash
		}

		if (opener instanceof HTMLAnchorElement) {
			const href = opener.getAttribute('href')

			return href && href[0] === '#' ? href.slice(1) : undefined
		}

		return undefined
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

export type BeforeOpenEvent = CustomEvent<{ opener: Element | null; event?: Event | CustomEvent }>
export type AfterOpenEvent = CustomEvent<{ opener: Element | null; event?: Event | CustomEvent }>
export type LoadEvent = CustomEvent<{ opener: Element | null; event?: Event | CustomEvent }>
export type BeforeCloseEvent = CustomEvent<{ opener: Element | null; event?: Event | CustomEvent }>
export type AfterCloseEvent = CustomEvent<{ opener: Element | null; event?: Event | CustomEvent }>

interface PdModalEventMap {
	beforeOpen: BeforeOpenEvent
	afterOpen: AfterOpenEvent
	load: LoadEvent
	beforeClose: BeforeCloseEvent
	afterClose: AfterCloseEvent
}
