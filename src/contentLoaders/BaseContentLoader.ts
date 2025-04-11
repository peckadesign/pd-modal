import { ContentLoaderListener, PdModal } from '../PdModal'

export class BaseContentLoader {
	public classList: string[] = []
	public listeners: ContentLoaderListener<any>[] = []

	protected modal: PdModal

	public constructor(modal: PdModal) {
		this.modal = modal
	}
}
