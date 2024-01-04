import { ContentLoader, PdModalOpener } from '../PdModal'
import { BaseContentLoader } from './BaseContentLoader'

export class NajaContentLoader extends BaseContentLoader implements ContentLoader {
	public matcher(opener: PdModalOpener): boolean {
		return (
			opener === null ||
			opener.dataset.najaModal !== undefined ||
			(opener.classList.contains('ajax') && this.modal.isOpen)
		)
	}

	public isAsync(): boolean {
		return true
	}

	public openContent(): boolean {
		if (this.modal.options.spinner) {
			this.modal.content.replaceChildren(this.modal.options.spinner)
		}

		this.modal.title.innerHTML = this.modal.i18n[this.modal.options.language].loading
		this.modal.title.dataset.contentLoading = 'true'
		this.modal.title.hidden = false

		return false
	}
}
