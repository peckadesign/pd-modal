import { ContentLoader, PdModal, PdModalOpener } from '../PdModal'

export class HTMLContentLoader implements ContentLoader {
	public matcher(opener: PdModalOpener): boolean {
		return opener !== null && this.getHash(opener) !== undefined
	}

	public isAsync(): boolean {
		return false
	}

	public openContent(modal: PdModal, opener: PdModalOpener): boolean {
		// This method is called only when matcher return true, therefore `opener` is always non-null and `hash` is
		// always a string
		const nonNullOpener = opener as NonNullable<PdModalOpener>
		const hash = this.getHash(nonNullOpener) as string

		const contentElement: HTMLElement | null = document.getElementById(hash)

		if (contentElement) {
			modal.content.innerHTML = contentElement.innerHTML
		}

		const title = this.getModalTitle(modal, nonNullOpener)
		modal.setModaltitle(title)

		return true
	}

	public autoBind(modal: PdModal): void {
		document.addEventListener('click', (event) => {
			const targetNew = event.button || event.ctrlKey || event.shiftKey || event.altKey || event.metaKey
			const element = event.target as Element
			let opener = null

			if (element && element.matches(modal.options.selector)) {
				opener = element as HTMLElement | SVGElement
			} else {
				opener = element.closest<HTMLElement | SVGElement>(modal.options.selector)
			}

			if (opener && (this.getHash(opener) || !targetNew)) {
				event.preventDefault()
				modal.open(opener, event)
			}
		})
	}

	private getHash(opener: NonNullable<PdModalOpener>): string | undefined {
		if (opener.dataset.modalHash) {
			return opener.dataset.modalHash
		}

		if (opener instanceof HTMLAnchorElement) {
			const href = opener.getAttribute('href')

			return href && href[0] === '#' ? href.slice(1) : undefined
		}

		return undefined
	}

	private getModalTitle(modal: PdModal, opener: NonNullable<PdModalOpener>): string | undefined {
		let title = opener.dataset.modalTitle

		if (!title) {
			const headingElement = modal.content.querySelector<HTMLElement>('[data-modal-title], h1, h2, h3, h4, h5, h6')
			title = headingElement?.innerHTML
		}

		return title
	}
}
