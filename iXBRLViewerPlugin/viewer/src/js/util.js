// See COPYRIGHT.md for copyright information

import moment from "moment";
import Decimal from "decimal.js";
import i18next from "i18next";


export const SHOW_FACT = 'SHOW_FACT';

export const NAMESPACE_ISO4217 = 'http://www.xbrl.org/2003/iso4217';

export const CALC_ARCROLE = "calc";
export const CALC11_ARCROLE = "calc11";

// The number of distinct highlight colors defined in inspector.less
export const HIGHLIGHT_COLORS = 3;

/* 
 * Takes a moment.js oject and converts it to a human readable date, or date
 * and time if the time component is not midnight.  Adjust specifies that a
 * date (but not a date time) should be shown as the day before.  This is to
 * satisfy the human convention of describing durations using inclusive dates.
 *
 * i.e. 2018-01-01T00:00:00 to 2019-01-01T00:00:00 is described as
 *      "Jan 1 2018 to Dec 31 2018"
 *
 */
export function momentToHuman(d, adjust) {
    if (d.hours() + d.minutes() + d.seconds() === 0) { 
        if (adjust) {
            d = d.clone().subtract(1, 'day');
        }
        return d.format('D MMM Y');
    }
    return d.format("D MMM Y HH:mm:ss");
}

/*
 * Format a number with a thousands separator, and the specified number of
 * decimal places.
 */
export function formatNumber(value, decimals) {
    const n = Decimal(value);
    const s = decimals === undefined ? n.toFixed() : n.toFixed(Math.max(0, decimals));
    const parts = s.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join('.');
}

/* 
 * Takes a string phrase and breaks it into separate phrases no bigger than
 * 'maxwidth'. breaks are made at complete words.
 */
export function wrapLabel(str, maxwidth) {
    const sections = [];
    const words = str.split(" ");
    let temp = "";

    words.forEach((item, index) => {
        if (temp.length > 0) {
            const concat = temp + ' ' + item;

            if (concat.length > maxwidth){
                sections.push(temp);
                temp = "";
            }
            else {
                if (index === (words.length-1)) {
                    sections.push(concat);
                    return;
                }
                else {
                    temp = concat;
                    return;
                }
            }
        }

        if (index === (words.length-1)) {
            sections.push(item);
            return;
        }

        if (item.length < maxwidth) {
            temp = item;
        }
        else {
            sections.push(item);
        }
    });
    return sections;
}

/*
 * Truncate the label to the specified length, breaking on a word boundary, and
 * adding an ellipsis if the label is actually shortened.
 */
export function truncateLabel(label, length) {
    let vv = wrapLabel(label, length);
    let t = vv[0];
    if (vv.length > 1) {
        t += ' \u2026';
    }
    return t;
}

/* 
 * The JSON format supports datetimes being abbreviated to just xsd:dates.
 * moment.js doesn't support timezoned dates, so fix them to midnight before
 * passing to moment 
 *
 * Note that the strings we're working with are not raw XBRL 2.1 dates, and
 * do not apply different conventions for start and aned dates.  A date
 * with no time part always means T00:00:00.
 */
export function xbrlDateToMoment(dateString) {
    /* If the string has something after the date part other than a time part,
     * insert a time part of 'T00:00:00'
     *
     * i.e. 2010-01-01Z => 2010-01-01T00:00:00Z
     */
    dateString = dateString.replace(
        /^(\d{4,}-\d{2}-\d{2})(?!T|$)/, 
        (match, $1) => $1 + 'T00:00:00'
    );
    return moment.utc(dateString);
}

export function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

export function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
 }

 // popper.js code fragment
 // Copyright � 2016 Federico Zivolo and contributors (The MIT License)
 function getParentNode(element) {
    if (element.nodeName === 'HTML' || element.nodeName === 'html') {
      return element;
    }
    return element.parentNode || element.host;
  }

  export function getStyleComputedProperty(element, property) {
    if (element.nodeType !== 1) {
      return [];
    }
    const window = element.ownerDocument.defaultView;
    const css = window.getComputedStyle(element, null);
    return property ? css[property] : css;
  }

 export function getScrollParent(element) {
    // Return body, `getScroll` will take care to get the correct `scrollTop` from it
    if (!element) {
      return document.body
    }
  
    switch (element.nodeName) {
      case 'HTML':
      case 'html':
      case 'BODY':
      case 'body':        
      case '#document':
        return element.ownerDocument.body;
    }
  
    // Firefox want us to check `-x` and `-y` variations as well
    const { overflow, overflowX, overflowY } = getStyleComputedProperty(element);
    if (/(auto|scroll|overlay)/.test(overflow + overflowY + overflowX)) {
      return element;
    }
  
    return getScrollParent(getParentNode(element));
  }
  // end code fragment
export function setDefault(obj, key, def) {
    if (!obj.hasOwnProperty(key)) {
        obj[key] = def;
    }
    return obj[key];
}

export function runGenerator(generator) {
    function resume() {
        const res = generator.next();
        if (!res.done) {
            setTimeout(resume, 0);
        }
        return;
    }
    setTimeout(resume, 0);
}

/**
 * Word-by-word title-casing that preserves existing uppercase characters
 * @param  {String} text  Text to title-case
 * @return {String} Title-cased string
 */
export function titleCase(text) {
    if (!text) return text;
    return text.split(' ').map(word => {
        return Array.from(word)
                .map((c, i) => (i === 0) ? c.toUpperCase() : c)
                .join('');
    }).join(' ');
}

/**
 * Extract the alpha value from an rgba(r,g,b,a) string and returns true if
 * transparent (a < 10%).  Returns false on rgb(r,g,b) strings.
 * @param  {String}  rgba   color string to parse
 * @return {Boolean} whether the value is transparent
 */
export function isTransparent(rgba) {
    const val = parseFloat(rgba.split(",")[3]);
    return !isNaN(val) && val < 0.1;
}

/**
 * Prefix an item ID with the index of the report document that it appears in,
 * in order to generate an ID that is guaranteed to be unique within the
 * viewer. This is already within an iXBRL Document Set, but not across
 * separate iXBRL documents or document sets.
 * @param  {Number}  sourceReportIndex - index of the report document containing the fact
 * @param  {String}  localId - local ID of the fact
 * @return {String}   a viewer unique ID
 */

export function viewerUniqueId(sourceReportIndex, localId) {
    if (localId === null || localId === undefined) {
        return null;
    }
    return sourceReportIndex.toString() + "-" + localId;
}

export function localId(viewerUniqueId) {
    return viewerUniqueId.replace(/^\d+-/,"");
}

/**
 * Parses fact IDs from -sec-ix-hidden and -esef-ix-hidden style 
 * attributes on a DOM node.  
 * Any returned ID should be the ID of a fact in ix:hidden corresponding
 * to the content contained in the DOM node.
 * 
 * @param  {Node}     domNode - DOM node to parse
 * @return {String}   A fact ID, or null if the element does not have 
 * a style attribute containing a custom CSS property in the required 
 * format.
 */

export function getIXHiddenLinkStyle(domNode) {
    if (domNode.hasAttribute('style')) {
        const re = /(?:^|\s|;)-(?:sec|esef)-ix-hidden:\s*([^\s;]+)/;
        const m = domNode.getAttribute('style').match(re);
        if (m) {
            return m[1];
        }
    }
    return null;
}

/**
 * Transforms measure qname into title case label (or currency symbol, if applicable).
 * @return {String} Measure Label
 */

export function measureLabel(report, measure) {
    const qname = report.qname(measure);
    if (qname.namespace === NAMESPACE_ISO4217) {
        measure = i18next.t(`currencies:unitFormat${qname.localname}`, {defaultValue: qname.localname});
    } else if (measure.includes(':')) {
        measure = measure.split(':')[1];
    }
    return measure;
}

export function zoom(container, scrollParent, scale) {
    var viewTop = scrollParent.scrollTop();
    var viewLeft = scrollParent.scrollLeft();
    var rc = container[0].getBoundingClientRect();
    container.css({
        '-moz-transform-origin': 'center 0',
        '-moz-transform': 'scale(' + scale + ')',
        'transform-origin': 'center 0',
        'transform': 'scale(' + scale + ')',
    }).promise().done(function() {
        var rcNew = container[0].getBoundingClientRect();
        container.css({
            'margin-top': 0,
            'margin-left': (rcNew.width - container[0].clientWidth)/2,
            'margin-bottom': rcNew.height - container[0].clientHeight, 
            'margin-right': (rcNew.width - container[0].clientWidth)/2,
        });        
        scrollParent.scrollLeft(rcNew.width * (viewLeft)/rc.width);
        scrollParent.scrollTop(rcNew.height * (viewTop)/rc.height);       
    });
}
