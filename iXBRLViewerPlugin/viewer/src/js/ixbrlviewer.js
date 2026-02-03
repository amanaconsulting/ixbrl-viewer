// See COPYRIGHT.md for copyright information

import interact from 'interactjs'
import $ from 'jquery'
import { ReportSet } from "./reportset.js";
import { Viewer, DocumentTooLargeError } from "./viewer.js";
import { Inspector } from "./inspector.js";
import { initializeTheme } from './theme.js';
import { TaxonomyNamer } from './taxonomynamer.js';
import { FEATURE_GUIDE_LINK, FEATURE_REVIEW, FEATURE_SUPPORT_LINK, FEATURE_SURVEY_LINK, USER_GUIDE_URL, moveNonAppAttributes } from "./util";

const featureFalsyValues = new Set([undefined, null, '', 'false', false]);

function bindEvents() { // AMANA extension
    if (typeof CefSharp !== "undefined") {
        CefSharp.BindObjectAsync("boundEvent");
    }
}

export class iXBRLViewer {

    constructor(options) {
        this._staticFeatures = {};
        this._dynamicFeatures = {};
        this._plugins = [];
        this.inspector = new Inspector(this);
        this.viewer = null;
        this._width = undefined;
        options = options || {};
        const defaults = {
            showValidationWarningOnStart: false,
            continuationElementLimit: Number.MAX_SAFE_INTEGER
        }
        this.options = { ...defaults, ...options };
        this.isPDF = false;
        bindEvents();
    }

    /*
    * Adds a plugin to the viewer.  The plugin should be an object with one or
    * more of the methods listed below, which will be called by the viewer.
    *
    * preProcessiXBRL(bodyElement, docIndex)
    *
    * Called upon viewer intialisation, once for each iXBRL document.  bodyElement
    * is a DOM object for the body element.  docIndex is the index of the document
    * within the document set.
    *
    * updateViewerStyleElement(styleElts)
    *
    * styleElts is a JQuery object consisting of the viewer style elements for
    * each document in the document set.  Additional CSS can be appended to the
    * contents, or additional header elements inserted relative to the provided
    * style element.
    *
    * extendDisplayOptionsMenu(menu)
    *
    * Called when the display options menu is created or recreated.  menu is a
    * Menu object, and can be modified to add additional menu items.
    *
    * extendHighlightKey(key)
    *
    * Called when the highlight color key is created.  key is an array of labels,
    * which can be modified or extended.
    *
    * extendDisplayTextblock(doc, fact)
    *
    * Called when the textblock for a fact is rendered. doc is the iframe document
    *
    */
    registerPlugin(plugin) {
        this._plugins.push(plugin);
    }

    hasPluginMethod(methodName) {
        var iv = this;
        var hasMethod = false;
        $.each(iv._plugins, function (n, p) {
            if (typeof p[methodName] === 'function') {
                hasMethod = true;
            }
        });
        return hasMethod;
    }

    callPluginMethod(methodName, ...args) {
        var iv = this;
        $.each(iv._plugins, function (n, p) {
            if (typeof p[methodName] === 'function') {
                p[methodName](...args);
            }
        });
    }

    pluginPromise(methodName, ...args) {
        var iv = this;
        return new Promise(function (resolve, reject) {
            /* Call promises in turn */
            (async function () {
                for (var n = 0; n < iv._plugins.length; n++) {
                    var p = iv._plugins[n];
                    if (typeof p[methodName] === 'function') {
                        await p[methodName](...args);
                    }
                }
            })().then(() => {
                resolve();
            });
        });
    }

    _getChromeVersion() {
        var raw = navigator.userAgent.match(/Chrom(e|ium)\/(\d+)\./);
        return raw ? parseInt(raw[2], 10) : null;
    }

    _inIframe() {
        try {
            return window.self !== window.top;
        } catch (e) {
            return true;
        }
    }

    _detectPDF(document) {
        var pageContainer = $("div#page-container", document);
        if (pageContainer.length > 0) {
            var generator = $('meta[name=generator]', this._contents).attr("content");
            if (generator === 'pdf2htmlEX') {
                if (pageContainer.css('position') == 'absolute') {
                    return true;
                }
            }
            if (pageContainer.find("div.pf[style*='content-visibility']").length > 0) {
                if (pageContainer.css('position') == 'absolute') {
                    return true;
                }
            }
        }
        return false;
    }

    _fixChromeBug(iframe) {
        var chromeVersion = this._getChromeVersion();
        if (chromeVersion && chromeVersion >= 88 && chromeVersion < 107) { // Giving a chance for Google to fix this
            var doc = iframe.contentDocument || iframe.contentWindow.document;
            var pageContainer = $(doc).find("div#page-container"); // PDF
            if (pageContainer.length > 0) {
                pageContainer.find("div.pf").css("content-visibility", "");
            } else {
                pageContainer = $(doc).find("div.box"); // IDML
                if (pageContainer.length > 0) {
                    pageContainer.find("div.page_A4").css("content-visibility", "");
                }
            }
        }
    }

    setFeatures(features, queryString) {
        this._staticFeatures = {}
        for (const [key, value] of Object.entries(features)) {
            this._staticFeatures[key] = value;
        }

        const urlParams = new URLSearchParams(queryString);
        this._dynamicFeatures = {}
        urlParams.forEach((value, key) => {
            if (value === '') {
                if (this._dynamicFeatures[key] === undefined) {
                    value = 'true'
                } else {
                    return;
                }
            }
            this._dynamicFeatures[key] = value;
        });
    }

    getStaticFeatureValue(featureName) {
        return this._staticFeatures[featureName];
    }

    getFeatureValue(featureName) {
        if (this._dynamicFeatures[featureName]) {
            return this._dynamicFeatures[featureName];
        }
        return this.getStaticFeatureValue(featureName);
    }

    isFeatureEnabled(featureName) {
        return !featureFalsyValues.has(this.getFeatureValue(featureName));
    }

    isStaticFeatureEnabled(featureName) {
        return !featureFalsyValues.has(this.getStaticFeatureValue(featureName));
    }

    isReviewModeEnabled() {
        return this.isFeatureEnabled(FEATURE_REVIEW);
    }

    getGuideLinkUrl() {
        if (!this.isStaticFeatureEnabled(FEATURE_GUIDE_LINK)) {
            return USER_GUIDE_URL;
        }
        return this.resolveRelativeUrl(this.getStaticFeatureValue(FEATURE_GUIDE_LINK));
    }

    getSupportLinkUrl() {
        if (!this.isStaticFeatureEnabled(FEATURE_SUPPORT_LINK)) {
            return null;
        }
        return this.resolveRelativeUrl(this.getStaticFeatureValue(FEATURE_SUPPORT_LINK));
    }

    getSurveyLinkUrl() {
        if (!this.isStaticFeatureEnabled(FEATURE_SURVEY_LINK)) {
            return null;
        }
        return this.resolveRelativeUrl(this.getStaticFeatureValue(FEATURE_SURVEY_LINK));
    }

    isViewerEnabled() {
        const urlParams = new URLSearchParams(window.location.search);
        return (urlParams.get('disable-viewer') ?? 'false') === 'false';
    }

    // Resolves URL relative to the config file
    resolveRelativeUrl(url) {
        if (this.options.configUrl === undefined) {
            return url;
        }
        const resolvedUrl = new URL(url, this.options.configUrl.href);
        return resolvedUrl.href;
    }

    _loadInspectorHTML() {
        /* Insert HTML and CSS styles into body */
        const footerLogoHtml = this.runtimeConfig.skin?.footerLogoHtml ?? require("../html/footer-logo.html");
        $(require('../html/inspector.html'))
            .prependTo('body')
            .find("#footer-logo").html(footerLogoHtml);
        const inspector_css = require('../less/inspector.less').toString();
        $('<style id="ixv-style"></style>')
            .prop("type", "text/css")
            .text(inspector_css)
            .appendTo('head');
        if (this.runtimeConfig.skin?.stylesheetUrl !== undefined) {
            $('<link rel="stylesheet" id="ixv-style-skin" />')
                .attr("href", this.resolveRelativeUrl(this.runtimeConfig.skin.stylesheetUrl))
                .appendTo('head');
        }
        const favIconUrl = this.runtimeConfig.skin?.faviconUrl !== undefined ? this.resolveRelativeUrl(this.runtimeConfig.skin.faviconUrl) : require("../img/favicon.ico");
        $('<link id="ixv-favicon" type="image/x-icon" rel="shortcut icon" />')
            .attr('href', favIconUrl)
            .appendTo('head');

        try {
            $('.inspector-foot .version').text(__VERSION__);
        }
        catch (e) {
            // ReferenceError if __VERSION__ not defined
        }
    }

    _reparentDocument(source, useFrames) {
        var iframeContainer = $('#ixv #iframe-container');

        if (useFrames) {
            const iframe = $('<iframe title="iXBRL document view" tabindex="0"/>')
                .data("report-index", 0)
                .appendTo(iframeContainer)[0];

            let docTitle = $('title', source).text();
            if (docTitle !== "") {
                docTitle = `Inline Viewer - ${docTitle}`;
            }
            else {
                docTitle = "Inline Viewer";
            }

            $('head', source)
                .children().not("script, style#ixv-style, link#ixv-style-skin, link#ixv-favicon").appendTo($(iframe).contents().find('head'));

            $('<title>', source).text(docTitle).appendTo($('head', source));

            /* Due to self-closing tags, our script tags may not be a direct child of
             * the body tag in an HTML DOM, so move them so that they are */
            $('body script', source).appendTo($('body'));

            const html = $('html', source);
            const body = $('body', source);
            const iframeHtml = $(iframe).contents().find('html');
            const iframeBody = $(iframe).contents().find('body');
            moveNonAppAttributes(html.get(0), iframeHtml.get(0));
            moveNonAppAttributes(body.get(0), iframeBody.get(0));
            html.attr('xmlns', 'http://www.w3.org/1999/xhtml');

            body.children().not("script").not('#ixv').not(iframeContainer).appendTo(iframeBody);

            /* Avoid any inline styles on the old body interfering with the inspector */
            body.removeAttr('style');
            return iframe;

        } else {
            // {{ AMANA: ensure iframe-div exists inside iframe-container
            var iframediv = $('#iframe-div');
            if (iframediv.length === 0) {
                iframediv = $('<div id="iframe-div"></div>').appendTo(iframeContainer);
            }
            // }}
            $('body', source).children().not("script").not('#ixv').not(iframeContainer).appendTo(iframediv);

            if (!source[0].isSameNode(document)) {
                $('head', source).children('style').appendTo($('head'));
                $('head title').replaceWith($('head title', source));
            }

            $('<style></style>')
                .prop('type', 'text/css')
                .html('.checked { background: none; }')
                .appendTo($('head'));

            return $(document).data("report-index", 0);
        }
    }

    _getTaxonomyData() {
        for (let i = document.body.children.length - 1; i >= 0; i--) {
            const elt = document.body.children[i];
            if (elt.tagName.toUpperCase() === 'SCRIPT' && elt.getAttribute("type") === 'application/x.ixbrl-viewer+json') {
                return elt.innerHTML;
            }
        }
        return null;
    }

    _checkDocumentSetBrowserSupport() {
        if (document.location.protocol === 'file:') {
            alert("Displaying iXBRL document sets from local files is not supported.  Please view the viewer files using a web server.");
        }
    }

    _loadRuntimeConfig() {
        return new Promise((resolve, reject) => {
            if (this.options.configUrl === undefined) {
                resolve({});
            }
            else {
                fetch(this.options.configUrl)
                    .then((resp) => {
                        switch (resp.status) {
                            case 200:
                                return resp.json();
                            case 404:
                                return Promise.resolve({});
                            default:
                                return Promise.reject(`Fetch of ${this.options.configUrl} failed: ${resp.status}`);
                        };
                    })
                    .then((data) => {
                        resolve(data);
                    })
                    .catch((err) => {
                        console.log(err);
                        resolve({});
                    });
            }
        });
    }

    load() {
        /* AMANA: Portal extensions. Checking if inspector.html already loaded as part of portal template */
        var iv = this;
        var iframeDiv = $('#ixv #iframe-container #iframe-div');
        if (iframeDiv.length > 0) {
            var src = iframeDiv[0].dataset.src;
            $.get(src, function (data) {
                var doc = $(data);
                iv._load(doc, false);
            });
        }
        else {
            iv._load($(document), true);
        }
    }

    _load(ownerDocument, loadHtml) {
        const iv = this;
        const inspector = this.inspector;

        this._loadRuntimeConfig().then((runtimeConfig) => {
            this.runtimeConfig = runtimeConfig;
            initializeTheme();

            const stubViewer = $('body').hasClass('ixv-stub-viewer');

            // If viewer is disabled, but not in stub viewer mode, just abort
            // loading to leave the iXBRL file as-is
            if (!iv.isViewerEnabled() && !stubViewer) {
                return;
            }

            // Loading mask starts here
            if (loadHtml) {
                iv._loadInspectorHTML();
            }

            let iframes = $();
            let parsedTaxonomyData;

            /* AMANA extension: In a case of multifile iXBRL attach JSON into every HTML page is too expensive --> */
            if (window.hasOwnProperty('xbrldata__')) {
                /* We do not use dynamic loading external JSON via jQuery because it does not work for file:// protocol
                    insted of this we generate script with assignment window.xbrldata__ = { <JSONdata> }; */
                parsedTaxonomyData = window.xbrldata__;
            } else {
                var taxonomyData = iv._getTaxonomyData();
                parsedTaxonomyData = taxonomyData && JSON.parse(taxonomyData);
            }

            let features = parsedTaxonomyData?.features;
            if (!features) {
                features = {};
            }
            // `features` was previously an array of flag values
            // Support this for backwards compatability
            else if (Array.isArray(features)) {
                features = features.reduce((obj, val) => {
                    obj[val] = true;
                    return obj;
                }, {});
            }
            if (this.runtimeConfig.features !== undefined) {
                features = {...this.runtimeConfig.features, features};
            }
            iv.setFeatures(features, window.location.search);

            const reportSet = new ReportSet(parsedTaxonomyData);
            reportSet.taxonomyNamer = new TaxonomyNamer(new Map(Object.entries(this.runtimeConfig.taxonomyNames ?? {})));

            // Viewer disabled in stub viewer mode => redirect to first iXBRL document
            if (!iv.isViewerEnabled()) {
                window.location.replace(reportSet.reportFiles()[0].file);
                return;
            }

            if (parsedTaxonomyData === null) {
                $('#ixv .loader .text').text("Error: Could not find viewer data");
                $('#ixv .loader').removeClass("loading");
                return;
            }

            iv.isPDF = iv._detectPDF(ownerDocument);
            var useFrames = !iv.isPDF || reportSet.isMultiDocumentViewer();
            if (!stubViewer) {
                /* AMANA: In the chromium, pdf files do not use frames in case of content-visibility CSS style  */
                iframes = $(iv._reparentDocument(ownerDocument, useFrames));
            }

            const ds = reportSet.reportFiles();
            let hasExternalIframe = false;
            for (let i = stubViewer ? 0 : 1; i < ds.length; i++) {
                const iframe = $('<iframe tabindex="0" />').attr("src", ds[i].file).data("report-index", ds[i].index).appendTo("#ixv #iframe-container");
                iframes = iframes.add(iframe);
                hasExternalIframe = true;
            }
            if (hasExternalIframe) {
                iv._checkDocumentSetBrowserSupport();
            }

            const progress = stubViewer ? 'Loading iXBRL Report' : 'Loading iXBRL Viewer';
            iv.setProgress(progress).then(() => {
                /* Poll for iframe load completing - there doesn't seem to be a reliable event that we can use */
                const timer = setInterval(() => {
                    let complete = true;
                    if (useFrames) {
                        iframes.each((n, iframe) => {
                            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                            if ((iframeDoc.readyState !== 'complete' && iframeDoc.readyState !== 'interactive') || $(iframe).contents().find("body").children().length === 0) {
                                complete = false;
                            }
                        });
                    }
                    if (complete) {
                        clearInterval(timer);
                        if (useFrames) {
                            iframes.each(function (n) {
                                /* fix chrome 88 content-visibility issue */
                                iv._fixChromeBug(this);
                            });
                        }

                        iframes.each((n, iframe) => {
                            const htmlNode = $(iframe).contents().find('html');
                            // A schema valid report should not have a lang attribute on the html element.
                            // However, if the report is not schema valid, we shouldn't override it.
                            if (htmlNode.attr('lang') === undefined) {
                                // If the report has an XML lang attribute, use it as the HTML lang for screen readers.
                                // If the language of the report can't be detected, set it to an empty string to avoid
                                // inheriting the lang of the application HTML node (which is set to the UI language).
                                const docLang = htmlNode.attr('xml:lang') || '';
                                htmlNode.attr('lang', docLang);
                            }
                        });

                        const viewer = new Viewer(iv, iframes, reportSet, useFrames);
                        iv.viewer = viewer

                        viewer.initialize()
                            .then(() => inspector.initialize(reportSet, viewer))
                            .then(() => {
                                interact('#viewer-pane').resizable({
                                    edges: { left: false, right: ".resize", bottom: false, top: false },
                                    restrictEdges: {
                                        outer: 'parent',
                                        endOnly: true,
                                    },
                                    restrictSize: {
                                        min: { width: 100 }
                                    },
                                })
                                .on('resizestart', () =>
                                    $('#ixv').css({ "pointer-events": "none", "-moz-user-select": "none" })
                                )
                                .on('resizemove', (event) => {
                                    const target = event.target;
                                    const w = 100 * event.rect.width / $(target).parent().width();
                                    target.style.width = `${w}%`;
                                    $('#inspector').css('width', `${100 - w}%`);
                                })
                                .on('resizeend', (event) =>
                                    $('#ixv').css({ "pointer-events": "auto", "-moz-user-select": "all" })
                                );
                                $('#ixv .loader').remove();

                                /* Focus on fact specified in URL fragment, if any */
                                if (iv.options.showValidationWarningOnStart) {
                                    inspector.showValidationWarning();
                                }
                                viewer.postLoadAsync();
                                inspector.postLoadAsync();
                            })
                            .catch(err => {
                                if (err instanceof DocumentTooLargeError) {
                                    $('#ixv .loader').remove();
                                    $('#inspector').addClass('failed-to-load');
                                }
                                else {
                                    throw err;
                                }

                            })
                            .then(() => viewer.notifyReady());
                    }
                }, 250);
            });
        });
    }

    /* Update the progress message during initial load.  Returns a Promise which
    * resolves once the message is actually displayed */
    setProgress(msg) {
        return new Promise((resolve, reject) => {
            /* We need to do a double requestAnimationFrame, as we need to get the
             * message up before the ensuing thread-blocking work
             * https://bugs.chromium.org/p/chromium/issues/detail?id=675795
             */
            window.requestAnimationFrame(() => {
                console.log(`%c [Progress] ${msg} `, 'background: #77d1c8; color: black;');
                $('#ixv .loader .text').text(msg);
                window.requestAnimationFrame(function () {
                    resolve();
                });
            });
        });
    }
}
