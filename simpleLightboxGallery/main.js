const DEFAULTS = Object.freeze({
	fitView: true,
	infinigall: true,
	uniqueGalleryGroups: true,
	overlayClose: true,
	spinner: 'pulse',
	navigation: true,
	numeration: true,
	share: true,
	download: true,
	copyLink: true,
	showCaption: true,
	shareStyle: 'pill',
	titlePosition: 'top',
	titleStyle: 'transparent',
	maxWidth: '100%',
	overlayColor: 'rgba(0,0,0,0.8)',
	bgcolor: 'rgba(38, 40, 44, 1)',
	toolsBackground: '#1C1C1C',
	toolsColor: '#d2d2d2',
	navKeyboard: true,
	navTouch: true,
	initialScale: 0.9,
	transitionSpeed: 200,
	navSpeed: 300,
	dialogLabel: 'Image gallery',
	closeLabel: 'Close',
	previousLabel: 'Previous image',
	nextLabel: 'Next image',
	shareLabel: 'Share image',
	downloadLabel: 'Download image',
	copyLinkLabel: 'Copy image link',
	copiedLabel: 'Link copied',
	loadingLabel: 'Loading image',
	loadErrorLabel: 'The image cannot be loaded',
	imageAltFallback: 'Gallery image',
	counterSeparator: ' / '
});

const ALLOWED_VALUES = Object.freeze({
	spinner: new Set(['plane', 'chase', 'bounce', 'wave', 'pulse', 'flow', 'swing', 'circle', 'circle-fade', 'grid', 'fold', 'wander']),
	shareStyle: new Set(['block', 'pill', 'transparent', 'bar']),
	titlePosition: new Set(['top', 'bottom']),
	titleStyle: new Set(['block', 'pill', 'transparent', 'bar'])
});

function hasOwn(object, key) {
	return Object.prototype.hasOwnProperty.call(object, key);
}

function getBoolean(value, fallback) {
	if (typeof value === 'boolean') return value;
	if (value === 'true' || value === 1 || value === '1') return true;
	if (value === 'false' || value === 0 || value === '0') return false;
	return fallback;
}

function getString(value, fallback) {
	return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function getSeparator(value, fallback) {
	return typeof value === 'string' && value.length ? value : fallback;
}

function getEnum(value, allowedValues, fallback) {
	return typeof value === 'string' && allowedValues.has(value) ? value : fallback;
}

function getNumber(value, fallback, min, max) {
	const parsed = typeof value === 'number' ? value : Number(value);
	if (!Number.isFinite(parsed)) return fallback;
	return Math.min(max, Math.max(min, parsed));
}

function getCssLength(value, fallback) {
	if (typeof value !== 'string') return fallback;
	const normalized = value.trim();
	return /^(?:0|(?:\d*\.?\d+)(?:px|rem|em|vh|vw|vmin|vmax|%|ch|ex|cm|mm|in|pt|pc))$/i.test(normalized)
		? normalized
		: fallback;
}

function getCssColor(value, fallback) {
	if (typeof value !== 'string') return fallback;
	const normalized = value.trim();
	const valid = /^(?:#[0-9a-f]{3,8}|(?:rgb|hsl)a?\([\d\s.,%+-]+\)|[a-z]+)$/i.test(normalized);
	return valid ? normalized : fallback;
}

function escapeHTMLAttribute(value) {
	return String(value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

class simpleLightboxGallery {
	constructor(API, name, config) {
		this.API = API;
		this.name = name;
		this.config = config && typeof config === 'object' ? config : {};

		this.API.addModifier('htmlOutput', this.modifyHTML.bind(this), 1, this);
		this.API.addInsertion('customHeadCode', this.addStyles.bind(this), 1, this);
		this.API.addInsertion('customFooterCode', this.addScripts.bind(this), 1, this);
	}

	modifyHTML(rendererInstance, htmlCode) {
		const assignUniqueGalleryGroups = getBoolean(this.config.uniqueGalleryGroups, DEFAULTS.uniqueGalleryGroups);
		const showCaption = getBoolean(this.config.showCaption, DEFAULTS.showCaption);

		function escapeHTML(value) {
			return value
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;')
				.replace(/"/g, '&quot;')
				.replace(/'/g, '&#39;');
		}

		const galleryRegex = /<div class="gallery.*?>[\s\S]*?<\/div>/gis;
		let galleryIndex = 0;

		return htmlCode.replace(galleryRegex, galleryMarkup => {
			galleryIndex++;
			const groupId = assignUniqueGalleryGroups ? `galleryGroup-${galleryIndex}` : 'galleryGroup';

			return galleryMarkup.replace(/<figure class="gallery__item">[\s\S]*?<\/figure>/gis, figureMarkup => {
				const figCaptionMatch = /<figcaption(?:\s+[^>]*)?>(.*?)<\/figcaption>/i.exec(figureMarkup);
				const title = figCaptionMatch ? figCaptionMatch[1].trim() : '';

				return figureMarkup.replace(/<a (.*?)>/, (match, attributes) => {
					let modifiedAttributes = attributes;

					if (!/data-gall="[^"]*"/.test(modifiedAttributes)) {
						modifiedAttributes += ` data-gall="${groupId}"`;
					}

					if (!showCaption) {
						modifiedAttributes = modifiedAttributes.replace(/\s+data-title=(?:"[^"]*"|'[^']*')/gi, '');
					} else if (title && !/data-title="[^"]*"/.test(modifiedAttributes)) {
						modifiedAttributes += ` data-title="${escapeHTML(title)}"`;
					}

					return `<a ${modifiedAttributes}>`;
				});
			});
		});
	}

	addStyles(rendererInstance, context) {
		if (!context.post?.hasGallery && !context.page?.hasGallery) return '';

		const baseURL = `${rendererInstance.siteConfig.domain}/media/plugins/simpleLightboxGallery`;
		return `
			<link rel="stylesheet" href="${baseURL}/venobox.min.css" />
			<link rel="stylesheet" href="${baseURL}/simple-lightbox-gallery.css" />
		`;
	}

	addScripts(rendererInstance, context) {
		if (!context.post?.hasGallery && !context.page?.hasGallery) return '';

		const config = this.config;
		const legacyShare = getBoolean(config.share, DEFAULTS.share);
		const download = hasOwn(config, 'download')
			? getBoolean(config.download, DEFAULTS.download)
			: legacyShare;
		const copyLink = hasOwn(config, 'copyLink')
			? getBoolean(config.copyLink, DEFAULTS.copyLink)
			: legacyShare;

		const controls = {
			keyboardNavigation: getBoolean(config.navKeyboard, DEFAULTS.navKeyboard),
			share: legacyShare,
			download,
			copyLink
		};

		const runtimeConfig = {
			venobox: {
				selector: '.gallery__item a',
				titleattr: 'data-title',
				bgcolor: getCssColor(config.bgcolor, DEFAULTS.bgcolor),
				fitView: getBoolean(config.fitView, DEFAULTS.fitView),
				focusItem: true,
				infinigall: getBoolean(config.infinigall, DEFAULTS.infinigall),
				maxWidth: getCssLength(config.maxWidth, DEFAULTS.maxWidth),
				navigation: getBoolean(config.navigation, DEFAULTS.navigation),
				navKeyboard: true,
				navTouch: getBoolean(config.navTouch, DEFAULTS.navTouch),
				navSpeed: getNumber(config.navSpeed, DEFAULTS.navSpeed, 0, 5000),
				numeration: getBoolean(config.numeration, DEFAULTS.numeration),
				overlayClose: getBoolean(config.overlayClose, DEFAULTS.overlayClose),
				overlayColor: getCssColor(config.overlayColor, DEFAULTS.overlayColor),
				share: controls.share || controls.download || controls.copyLink,
				shareStyle: getEnum(config.shareStyle, ALLOWED_VALUES.shareStyle, DEFAULTS.shareStyle),
				spinColor: getCssColor(config.toolsColor, DEFAULTS.toolsColor),
				spinner: getEnum(config.spinner, ALLOWED_VALUES.spinner, DEFAULTS.spinner),
				titlePosition: getEnum(config.titlePosition, ALLOWED_VALUES.titlePosition, DEFAULTS.titlePosition),
				titleStyle: getEnum(config.titleStyle, ALLOWED_VALUES.titleStyle, DEFAULTS.titleStyle),
				toolsBackground: getCssColor(config.toolsBackground, DEFAULTS.toolsBackground),
				toolsColor: getCssColor(config.toolsColor, DEFAULTS.toolsColor),
				initialScale: getNumber(config.initialScale, DEFAULTS.initialScale, 0.5, 1),
				transitionSpeed: getNumber(config.transitionSpeed, DEFAULTS.transitionSpeed, 0, 5000)
			},
			controls,
			labels: {
				dialog: getString(config.dialogLabel, DEFAULTS.dialogLabel),
				close: getString(config.closeLabel, DEFAULTS.closeLabel),
				previous: getString(config.previousLabel, DEFAULTS.previousLabel),
				next: getString(config.nextLabel, DEFAULTS.nextLabel),
				share: getString(config.shareLabel, DEFAULTS.shareLabel),
				download: getString(config.downloadLabel, DEFAULTS.downloadLabel),
				copyLink: getString(config.copyLinkLabel, DEFAULTS.copyLinkLabel),
				copied: getString(config.copiedLabel, DEFAULTS.copiedLabel),
				loading: getString(config.loadingLabel, DEFAULTS.loadingLabel),
				loadError: getString(config.loadErrorLabel, DEFAULTS.loadErrorLabel),
				imageAltFallback: getString(config.imageAltFallback, DEFAULTS.imageAltFallback),
				counterSeparator: getSeparator(config.counterSeparator, DEFAULTS.counterSeparator)
			}
		};

		const baseURL = `${rendererInstance.siteConfig.domain}/media/plugins/simpleLightboxGallery`;
		const serializedConfig = escapeHTMLAttribute(JSON.stringify(runtimeConfig));

		return `
			<script defer src="${baseURL}/venobox.min.js"></script>
			<script defer src="${baseURL}/simple-lightbox-gallery.js" data-config="${serializedConfig}"></script>
		`;
	}
}

module.exports = simpleLightboxGallery;
