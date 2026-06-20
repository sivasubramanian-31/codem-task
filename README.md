# Shopify Product Edit Page

## Overview

This project implements a Shopify Product Edit Page with Media and SEO tabs.

## Features

* Media management (add, remove, reorder images)
* SEO management (title, description, handle)
* Global Save and Discard actions
* Cross-tab state persistence
* Lazy-loaded SEO tab
* Validation and error handling
* No-op save optimization

## Diff Strategy

The application compares the current form state against the original values loaded from Shopify. Only modified fields are processed during save operations.

## Mutation Conditions

* productUpdate: SEO title, description, or handle changes.
* productCreateMedia: New images added.
* productUpdateMedia: Image alt text changes.
* productReorderMedia: Image order changes.
* productDeleteMedia: Existing images removed.
* No mutations execute when no changes are detected.

## Test Coverage

Critical user flows and error scenarios were manually tested, including loader validation, action validation, media operations, SEO updates, lazy loading, and save/discard behavior.
