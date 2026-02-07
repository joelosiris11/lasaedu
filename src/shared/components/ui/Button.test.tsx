import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from './Button'

describe('Button', () => {
  describe('rendering', () => {
    it('should render children correctly', () => {
      render(<Button>Click me</Button>)
      expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument()
    })

    it('should render as a button element', () => {
      render(<Button>Test</Button>)
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('should forward ref correctly', () => {
      const ref = { current: null }
      render(<Button ref={ref}>Test</Button>)
      expect(ref.current).toBeInstanceOf(HTMLButtonElement)
    })
  })

  describe('variants', () => {
    it('should apply default variant classes', () => {
      render(<Button variant="default">Default</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('bg-primary')
    })

    it('should apply destructive variant classes', () => {
      render(<Button variant="destructive">Destructive</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('bg-destructive')
    })

    it('should apply outline variant classes', () => {
      render(<Button variant="outline">Outline</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('border')
    })

    it('should apply ghost variant classes', () => {
      render(<Button variant="ghost">Ghost</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('hover:bg-accent')
    })

    it('should apply link variant classes', () => {
      render(<Button variant="link">Link</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('underline-offset-4')
    })
  })

  describe('sizes', () => {
    it('should apply default size classes', () => {
      render(<Button size="default">Default Size</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('h-10')
    })

    it('should apply small size classes', () => {
      render(<Button size="sm">Small</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('h-9')
    })

    it('should apply large size classes', () => {
      render(<Button size="lg">Large</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('h-11')
    })

    it('should apply icon size classes', () => {
      render(<Button size="icon">Icon</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('h-10', 'w-10')
    })
  })

  describe('disabled state', () => {
    it('should be disabled when disabled prop is true', () => {
      render(<Button disabled>Disabled</Button>)
      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
    })

    it('should apply disabled styles', () => {
      render(<Button disabled>Disabled</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('disabled:opacity-50')
    })
  })

  describe('click handling', () => {
    it('should call onClick when clicked', () => {
      const handleClick = vi.fn()
      render(<Button onClick={handleClick}>Click</Button>)

      fireEvent.click(screen.getByRole('button'))
      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('should not call onClick when disabled', () => {
      const handleClick = vi.fn()
      render(<Button onClick={handleClick} disabled>Click</Button>)

      fireEvent.click(screen.getByRole('button'))
      expect(handleClick).not.toHaveBeenCalled()
    })
  })

  describe('custom className', () => {
    it('should merge custom className with default classes', () => {
      render(<Button className="custom-class">Custom</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('custom-class')
      expect(button).toHaveClass('inline-flex') // Should still have base classes
    })
  })

  describe('button types', () => {
    it('should have default type of submit when not specified', () => {
      render(<Button>Submit</Button>)
      const button = screen.getByRole('button')
      // Default HTML button type is "submit"
      expect(button).not.toHaveAttribute('type', 'reset')
    })

    it('should accept type prop', () => {
      render(<Button type="submit">Submit</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('type', 'submit')
    })
  })
})
