import { PdModal } from './PdModal'
import { AjaxModal } from '@peckadesign/pd-naja/dist/extensions/AjaxModalExtension'

interface PdModalAjaxOptions {
	opener: string
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
		this.pdModal.dispatchLoadEvent(this.getOpenerFromOptions(options), event)
	}

	public getOptions(element: Element): PdModalAjaxOptions {
		return { opener: element.outerHTML }
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
}
