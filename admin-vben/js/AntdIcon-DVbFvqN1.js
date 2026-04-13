import{D as e,E as t,I as n,gt as r,j as i,k as a,vt as o,w as s}from"./vue.runtime.esm-bundler-w7BQ1r-D.js";import{T as c,w as l}from"./useConfigInject-BYh8MaPK.js";var u=Symbol(`iconContext`),d=function(){return i(u,{prefixCls:o(`anticon`),rootClassName:o(``),csp:o()})};function f(){return!!(typeof window<`u`&&window.document&&window.document.createElement)}function p(e,t){return e&&e.contains?e.contains(t):!1}var m=`data-vc-order`,h=`vc-icon-key`,g=new Map;function _(){var e=(arguments.length>0&&arguments[0]!==void 0?arguments[0]:{}).mark;return e?e.startsWith(`data-`)?e:`data-${e}`:h}function v(e){return e.attachTo?e.attachTo:document.querySelector(`head`)||document.body}function y(e){return e===`queue`?`prependQueue`:e?`prepend`:`append`}function b(e){return Array.from((g.get(e)||e).children).filter(function(e){return e.tagName===`STYLE`})}function x(e){var t=arguments.length>1&&arguments[1]!==void 0?arguments[1]:{};if(!f())return null;var n=t.csp,r=t.prepend,i=document.createElement(`style`);i.setAttribute(m,y(r)),n&&n.nonce&&(i.nonce=n.nonce),i.innerHTML=e;var a=v(t),o=a.firstChild;if(r){if(r===`queue`){var s=b(a).filter(function(e){return[`prepend`,`prependQueue`].includes(e.getAttribute(m))});if(s.length)return a.insertBefore(i,s[s.length-1].nextSibling),i}a.insertBefore(i,o)}else a.appendChild(i);return i}function S(e){var t=arguments.length>1&&arguments[1]!==void 0?arguments[1]:{};return b(v(t)).find(function(n){return n.getAttribute(_(t))===e})}function C(e,t){var n=g.get(e);if(!n||!p(document,n)){var r=x(``,t),i=r.parentNode;g.set(e,i),e.removeChild(r)}}function w(e,t){var n=arguments.length>2&&arguments[2]!==void 0?arguments[2]:{};C(v(n),n);var r=S(t,n);if(r)return n.csp&&n.csp.nonce&&r.nonce!==n.csp.nonce&&(r.nonce=n.csp.nonce),r.innerHTML!==e&&(r.innerHTML=e),r;var i=x(e,n);return i.setAttribute(_(n),t),i}function T(e){for(var t=1;t<arguments.length;t++){var n=arguments[t]==null?{}:Object(arguments[t]),r=Object.keys(n);typeof Object.getOwnPropertySymbols==`function`&&(r=r.concat(Object.getOwnPropertySymbols(n).filter(function(e){return Object.getOwnPropertyDescriptor(n,e).enumerable}))),r.forEach(function(t){E(e,t,n[t])})}return e}function E(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function D(e,t){`${t}`}function O(e){return typeof e==`object`&&typeof e.name==`string`&&typeof e.theme==`string`&&(typeof e.icon==`object`||typeof e.icon==`function`)}function k(e,t,n){return n?a(e.tag,T({key:t},n,e.attrs),(e.children||[]).map(function(n,r){return k(n,`${t}-${e.tag}-${r}`)})):a(e.tag,T({key:t},e.attrs),(e.children||[]).map(function(n,r){return k(n,`${t}-${e.tag}-${r}`)}))}function A(e){return c(e)[0]}function j(e){return e?Array.isArray(e)?e:[e]:[]}var M=`
.anticon {
  display: inline-block;
  color: inherit;
  font-style: normal;
  line-height: 0;
  text-align: center;
  text-transform: none;
  vertical-align: -0.125em;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.anticon > * {
  line-height: 1;
}

.anticon svg {
  display: inline-block;
}

.anticon::before {
  display: none;
}

.anticon .anticon-icon {
  display: block;
}

.anticon[tabindex] {
  cursor: pointer;
}

.anticon-spin::before,
.anticon-spin {
  display: inline-block;
  -webkit-animation: loadingCircle 1s infinite linear;
  animation: loadingCircle 1s infinite linear;
}

@-webkit-keyframes loadingCircle {
  100% {
    -webkit-transform: rotate(360deg);
    transform: rotate(360deg);
  }
}

@keyframes loadingCircle {
  100% {
    -webkit-transform: rotate(360deg);
    transform: rotate(360deg);
  }
}
`;function N(e){return e&&e.getRootNode&&e.getRootNode()}function ee(e){return f()?N(e)instanceof ShadowRoot:!1}function te(e){return ee(e)?N(e):null}var ne=function(){var t=d(),r=t.prefixCls,i=t.csp,a=e(),o=M;r&&(o=o.replace(/anticon/g,r.value)),n(function(){if(f()){var e=a.vnode.el,t=te(e);w(o,`@ant-design-vue-icons`,{prepend:!0,csp:i.value,attachTo:t})}})},re=[`icon`,`primaryColor`,`secondaryColor`];function ie(e,t){if(e==null)return{};var n=P(e,t),r,i;if(Object.getOwnPropertySymbols){var a=Object.getOwnPropertySymbols(e);for(i=0;i<a.length;i++)r=a[i],!(t.indexOf(r)>=0)&&Object.prototype.propertyIsEnumerable.call(e,r)&&(n[r]=e[r])}return n}function P(e,t){if(e==null)return{};var n={},r=Object.keys(e),i,a;for(a=0;a<r.length;a++)i=r[a],!(t.indexOf(i)>=0)&&(n[i]=e[i]);return n}function F(e){for(var t=1;t<arguments.length;t++){var n=arguments[t]==null?{}:Object(arguments[t]),r=Object.keys(n);typeof Object.getOwnPropertySymbols==`function`&&(r=r.concat(Object.getOwnPropertySymbols(n).filter(function(e){return Object.getOwnPropertyDescriptor(n,e).enumerable}))),r.forEach(function(t){I(e,t,n[t])})}return e}function I(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}var L=r({primaryColor:`#333`,secondaryColor:`#E6E6E6`,calculated:!1});function R(e){var t=e.primaryColor,n=e.secondaryColor;L.primaryColor=t,L.secondaryColor=n||A(t),L.calculated=!!n}function z(){return F({},L)}var B=function(e,t){var n=F({},e,t.attrs),r=n.icon,i=n.primaryColor,a=n.secondaryColor,o=ie(n,re),s=L;if(i&&(s={primaryColor:i,secondaryColor:a||A(i)}),D(O(r),`icon should be icon definiton, but got ${r}`),!O(r))return null;var c=r;return c&&typeof c.icon==`function`&&(c=F({},c,{icon:c.icon(s.primaryColor,s.secondaryColor)})),k(c.icon,`svg-${c.name}`,F({},o,{"data-icon":c.name,width:`1em`,height:`1em`,fill:`currentColor`,"aria-hidden":`true`}))};B.props={icon:Object,primaryColor:String,secondaryColor:String,focusable:String},B.inheritAttrs=!1,B.displayName=`IconBase`,B.getTwoToneColors=z,B.setTwoToneColors=R;function V(e,t){return K(e)||G(e,t)||U(e,t)||H()}function H(){throw TypeError(`Invalid attempt to destructure non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`)}function U(e,t){if(e){if(typeof e==`string`)return W(e,t);var n=Object.prototype.toString.call(e).slice(8,-1);if(n===`Object`&&e.constructor&&(n=e.constructor.name),n===`Map`||n===`Set`)return Array.from(e);if(n===`Arguments`||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n))return W(e,t)}}function W(e,t){(t==null||t>e.length)&&(t=e.length);for(var n=0,r=Array(t);n<t;n++)r[n]=e[n];return r}function G(e,t){var n=e==null?null:typeof Symbol<`u`&&e[Symbol.iterator]||e[`@@iterator`];if(n!=null){var r=[],i=!0,a=!1,o,s;try{for(n=n.call(e);!(i=(o=n.next()).done)&&(r.push(o.value),!(t&&r.length===t));i=!0);}catch(e){a=!0,s=e}finally{try{!i&&n.return!=null&&n.return()}finally{if(a)throw s}}return r}}function K(e){if(Array.isArray(e))return e}function q(e){var t=V(j(e),2),n=t[0],r=t[1];return B.setTwoToneColors({primaryColor:n,secondaryColor:r})}function J(){var e=B.getTwoToneColors();return e.calculated?[e.primaryColor,e.secondaryColor]:e.primaryColor}var ae=t({name:`InsertStyles`,setup:function(){return ne(),function(){return null}}}),oe=[`class`,`icon`,`spin`,`rotate`,`tabindex`,`twoToneColor`,`onClick`];function se(e,t){return ue(e)||X(e,t)||le(e,t)||ce()}function ce(){throw TypeError(`Invalid attempt to destructure non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`)}function le(e,t){if(e){if(typeof e==`string`)return Y(e,t);var n=Object.prototype.toString.call(e).slice(8,-1);if(n===`Object`&&e.constructor&&(n=e.constructor.name),n===`Map`||n===`Set`)return Array.from(e);if(n===`Arguments`||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n))return Y(e,t)}}function Y(e,t){(t==null||t>e.length)&&(t=e.length);for(var n=0,r=Array(t);n<t;n++)r[n]=e[n];return r}function X(e,t){var n=e==null?null:typeof Symbol<`u`&&e[Symbol.iterator]||e[`@@iterator`];if(n!=null){var r=[],i=!0,a=!1,o,s;try{for(n=n.call(e);!(i=(o=n.next()).done)&&(r.push(o.value),!(t&&r.length===t));i=!0);}catch(e){a=!0,s=e}finally{try{!i&&n.return!=null&&n.return()}finally{if(a)throw s}}return r}}function ue(e){if(Array.isArray(e))return e}function Z(e){for(var t=1;t<arguments.length;t++){var n=arguments[t]==null?{}:Object(arguments[t]),r=Object.keys(n);typeof Object.getOwnPropertySymbols==`function`&&(r=r.concat(Object.getOwnPropertySymbols(n).filter(function(e){return Object.getOwnPropertyDescriptor(n,e).enumerable}))),r.forEach(function(t){Q(e,t,n[t])})}return e}function Q(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function de(e,t){if(e==null)return{};var n=fe(e,t),r,i;if(Object.getOwnPropertySymbols){var a=Object.getOwnPropertySymbols(e);for(i=0;i<a.length;i++)r=a[i],!(t.indexOf(r)>=0)&&Object.prototype.propertyIsEnumerable.call(e,r)&&(n[r]=e[r])}return n}function fe(e,t){if(e==null)return{};var n={},r=Object.keys(e),i,a;for(a=0;a<r.length;a++)i=r[a],!(t.indexOf(i)>=0)&&(n[i]=e[i]);return n}q(l.primary);var $=function(e,t){var n,r=Z({},e,t.attrs),i=r.class,a=r.icon,o=r.spin,c=r.rotate,l=r.tabindex,u=r.twoToneColor,f=r.onClick,p=de(r,oe),m=d(),h=m.prefixCls,g=m.rootClassName,_=(n={},Q(n,g.value,!!g.value),Q(n,h.value,!0),Q(n,`${h.value}-${a.name}`,!!a.name),Q(n,`${h.value}-spin`,!!o||a.name===`loading`),n),v=l;v===void 0&&f&&(v=-1);var y=c?{msTransform:`rotate(${c}deg)`,transform:`rotate(${c}deg)`}:void 0,b=se(j(u),2),x=b[0],S=b[1];return s(`span`,Z({role:`img`,"aria-label":a.name},p,{onClick:f,class:[_,i],tabindex:v}),[s(B,{icon:a,primaryColor:x,secondaryColor:S,style:y},null),s(ae,null,null)])};$.props={spin:Boolean,rotate:Number,icon:Object,twoToneColor:[String,Array]},$.displayName=`AntdIcon`,$.inheritAttrs=!1,$.getTwoToneColor=J,$.setTwoToneColor=q;export{$ as t};