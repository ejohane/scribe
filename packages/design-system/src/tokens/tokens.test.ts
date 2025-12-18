/**
 * Tests for design system token exports
 *
 * Validates that all token categories and values are properly exported
 * and have the expected structure.
 */

import { describe, it, expect } from 'vitest';
import {
  vars,
  fadeIn,
  slideUp,
  slideDown,
  enter,
  spin,
  animateFadeIn,
  animateSlideUp,
  animateSlideDown,
  animateSpin,
} from './index';

describe('Design System Tokens', () => {
  describe('vars (theme contract)', () => {
    it('should export color tokens', () => {
      expect(vars.color).toBeDefined();
      expect(vars.color.background).toBeDefined();
      expect(vars.color.foreground).toBeDefined();
      expect(vars.color.accent).toBeDefined();
      expect(vars.color.danger).toBeDefined();
      expect(vars.color.warning).toBeDefined();
      expect(vars.color.info).toBeDefined();
      expect(vars.color.success).toBeDefined();
      expect(vars.color.secondary).toBeDefined();
      expect(vars.color.tertiary).toBeDefined();
    });

    it('should export typography tokens', () => {
      expect(vars.typography).toBeDefined();
      expect(vars.typography.fontFamily.ui).toBeDefined();
      expect(vars.typography.fontFamily.mono).toBeDefined();
      expect(vars.typography.fontFamily.serif).toBeDefined();
      expect(vars.typography.size.xs).toBeDefined();
      expect(vars.typography.size.md).toBeDefined();
      expect(vars.typography.size['3xl']).toBeDefined();
      expect(vars.typography.weight.regular).toBeDefined();
      expect(vars.typography.weight.bold).toBeDefined();
      expect(vars.typography.lineHeight.tight).toBeDefined();
      expect(vars.typography.lineHeight.relaxed).toBeDefined();
    });

    it('should export spacing tokens', () => {
      expect(vars.spacing).toBeDefined();
      expect(vars.spacing['0']).toBeDefined();
      expect(vars.spacing['1']).toBeDefined();
      expect(vars.spacing['4']).toBeDefined();
      expect(vars.spacing['24']).toBeDefined();
    });

    it('should export radius tokens', () => {
      expect(vars.radius).toBeDefined();
      expect(vars.radius.none).toBeDefined();
      expect(vars.radius.sm).toBeDefined();
      expect(vars.radius.md).toBeDefined();
      expect(vars.radius.full).toBeDefined();
    });

    it('should export shadow tokens', () => {
      expect(vars.shadow).toBeDefined();
      expect(vars.shadow.sm).toBeDefined();
      expect(vars.shadow.md).toBeDefined();
      expect(vars.shadow.lg).toBeDefined();
      expect(vars.shadow.xl).toBeDefined();
    });

    it('should export zIndex tokens', () => {
      expect(vars.zIndex).toBeDefined();
      expect(vars.zIndex.base).toBeDefined();
      expect(vars.zIndex.overlay).toBeDefined();
      expect(vars.zIndex.modal).toBeDefined();
      expect(vars.zIndex.tooltip).toBeDefined();
    });

    it('should export animation tokens', () => {
      expect(vars.animation).toBeDefined();
      expect(vars.animation.duration.fast).toBeDefined();
      expect(vars.animation.duration.normal).toBeDefined();
      expect(vars.animation.duration.slow).toBeDefined();
      expect(vars.animation.easing.default).toBeDefined();
      expect(vars.animation.easing.smooth).toBeDefined();
    });

    it('should export component-specific tokens', () => {
      expect(vars.component).toBeDefined();
      expect(vars.component.icon.xs).toBeDefined();
      expect(vars.component.icon.lg).toBeDefined();
      expect(vars.component.button.heightSm).toBeDefined();
      expect(vars.component.button.heightMd).toBeDefined();
      expect(vars.component.menu.minWidthSm).toBeDefined();
      expect(vars.component.menu.maxHeight).toBeDefined();
      expect(vars.component.spinner.size).toBeDefined();
      expect(vars.component.panel.slideOffset).toBeDefined();
    });

    it('should export blur tokens', () => {
      expect(vars.blur).toBeDefined();
      expect(vars.blur.sm).toBeDefined();
      expect(vars.blur.md).toBeDefined();
      expect(vars.blur.lg).toBeDefined();
    });
  });

  describe('animation keyframes', () => {
    it('should export fadeIn keyframe', () => {
      expect(fadeIn).toBeDefined();
      expect(typeof fadeIn).toBe('string');
    });

    it('should export slideUp keyframe', () => {
      expect(slideUp).toBeDefined();
      expect(typeof slideUp).toBe('string');
    });

    it('should export slideDown keyframe', () => {
      expect(slideDown).toBeDefined();
      expect(typeof slideDown).toBe('string');
    });

    it('should export enter keyframe', () => {
      expect(enter).toBeDefined();
      expect(typeof enter).toBe('string');
    });

    it('should export spin keyframe', () => {
      expect(spin).toBeDefined();
      expect(typeof spin).toBe('string');
    });
  });

  describe('animation utility styles', () => {
    it('should export animateFadeIn style', () => {
      expect(animateFadeIn).toBeDefined();
      expect(typeof animateFadeIn).toBe('string');
    });

    it('should export animateSlideUp style', () => {
      expect(animateSlideUp).toBeDefined();
      expect(typeof animateSlideUp).toBe('string');
    });

    it('should export animateSlideDown style', () => {
      expect(animateSlideDown).toBeDefined();
      expect(typeof animateSlideDown).toBe('string');
    });

    it('should export animateSpin style', () => {
      expect(animateSpin).toBeDefined();
      expect(typeof animateSpin).toBe('string');
    });
  });
});
