// React 19 dropped the global JSX namespace; consumers must now reach it via
// `React.JSX` or `import type { JSX } from 'react'`. This shim re-exposes JSX
// globally so existing `JSX.Element` return types and intrinsic-element
// signatures in this package continue to resolve without per-file imports.
//
// Remove this shim only after every reference has been migrated to the
// explicit `React.JSX` form.

import type { JSX as ReactJSX } from 'react';

declare global {
  namespace JSX {
    type Element = ReactJSX.Element;
    type ElementClass = ReactJSX.ElementClass;
    type ElementAttributesProperty = ReactJSX.ElementAttributesProperty;
    type ElementChildrenAttribute = ReactJSX.ElementChildrenAttribute;
    type LibraryManagedAttributes<C, P> = ReactJSX.LibraryManagedAttributes<C, P>;
    type IntrinsicAttributes = ReactJSX.IntrinsicAttributes;
    type IntrinsicClassAttributes<T> = ReactJSX.IntrinsicClassAttributes<T>;
    type IntrinsicElements = ReactJSX.IntrinsicElements;
    type ElementType = ReactJSX.ElementType;
  }
}

export {};
