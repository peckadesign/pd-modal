import { PdModal } from './PdModal'
import { AjaxModal } from '@peckadesign/pd-naja/dist/extensions/AjaxModalExtension'

type OptionWidth = string | null
type OptionClassName = string | null

interface PdModalAjaxOptions {
	opener: string
	width: OptionWidth
	className: OptionClassName
}

export class PdModalNajaAdapter implements AjaxModal {
	public element: Element
	public reservedSnippetIds: string[]

	private pdModal: PdModal

	public constructor(pdModal: PdModal, reservedSnippetIds: string[]) {
		this.pdModal = pdModal

		this.element = pdModal.element
		this.reservedSnippetIds = reservedSnippetIds
	}

	public show(opener: Element, options: PdModalAjaxOptions, event: Event): void {
		if (!opener.getAttribute('data-modal-width') && options.width) {
			opener.setAttribute('data-modal-width', String(options.width))
		}

		// `options.className` might be an empty string which we have to preserve
		if (!opener.getAttribute('data-modal-class-name') && options.className !== null) {
			opener.setAttribute('data-modal-class-name', options.className)
		}

		this.pdModal.open(opener as HTMLElement | SVGElement, event)
	}

	public hide(event: Event): void {
		this.pdModal.close(event)
	}

	public isShown(): boolean {
		return this.pdModal.isOpen
	}

	public onShow(callback: EventListener): void {
		this.pdModal.addEventListener('beforeOpen', callback)
	}

	public onHide(callback: EventListener): void {
		this.pdModal.addEventListener('beforeClose', callback)
	}

	public onHidden(callback: EventListener): void {
		this.pdModal.addEventListener('afterClose', callback)
	}

	public dispatchLoad(options: PdModalAjaxOptions, event: Event): void {
		if (this.pdModal.title.innerHTML !== this.pdModal.i18n[this.pdModal.options.language].loading) {
			delete this.pdModal.title.dataset.contentLoading
		}

		this.pdModal.dispatchLoadEvent(this.getOpenerFromOptions(options), event)
	}

	public getOptions(element: Element): PdModalAjaxOptions {
		return {
			opener: element.outerHTML,
			width: this.getWidth(element),
			className: this.getClassName(element)
		}
	}

	public setOptions(): void {
		// Remove options from previous opener. Current options are stored in PdModal class. Note that we are currently
		// removing only listeners from previous opener. The `width` and `className` are supposed to stay unless
		// overridden by new opener or until the modal is closed.
		this.pdModal.removeListenersFromOpener()

		// Set new options from update opener. Opener has been update in `show` method.
		this.pdModal.setOptionsFromOpener()
	}

	private getOpenerFromOptions(options: PdModalAjaxOptions): HTMLElement | SVGElement {
		return new DOMParser().parseFromString(options.opener, 'text/html').body.firstElementChild as
			| HTMLElement
			| SVGElement
	}

	private getWidth = (element: Element): OptionWidth => {
		return element.getAttribute('data-modal-width') || history.state?.pdModal?.options?.width || null
	}

	private getClassName(element: Element): OptionClassName {
		const dataClassName = element.getAttribute('data-modal-class-name')

		if (dataClassName !== null) {
			return dataClassName
		}

		return history.state?.pdModal?.options?.className || null
	}
}
