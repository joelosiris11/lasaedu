import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from './Input'

describe('Input', () => {
  describe('rendering', () => {
    it('should render an input element', () => {
      render(<Input />)
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('should forward ref correctly', () => {
      const ref = { current: null }
      render(<Input ref={ref} />)
      expect(ref.current).toBeInstanceOf(HTMLInputElement)
    })
  })

  describe('types', () => {
    it('should render text input by default', () => {
      render(<Input />)
      const input = screen.getByRole('textbox')
      // Input without explicit type defaults to "text" in behavior
      // Check if type is either undefined (implicit text) or explicitly "text"
      const typeAttr = input.getAttribute('type')
      expect(typeAttr === null || typeAttr === 'text').toBe(true)
    })

    it('should render email input', () => {
      render(<Input type="email" />)
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('type', 'email')
    })

    it('should render password input', () => {
      render(<Input type="password" />)
      // Password inputs don't have a role, so query by attribute
      const input = document.querySelector('input[type="password"]')
      expect(input).toBeInTheDocument()
    })

    it('should render number input', () => {
      render(<Input type="number" />)
      const input = screen.getByRole('spinbutton')
      expect(input).toHaveAttribute('type', 'number')
    })
  })

  describe('placeholder', () => {
    it('should display placeholder text', () => {
      render(<Input placeholder="Enter your name" />)
      expect(screen.getByPlaceholderText('Enter your name')).toBeInTheDocument()
    })
  })

  describe('value handling', () => {
    it('should display controlled value', () => {
      render(<Input value="test value" onChange={() => {}} />)
      expect(screen.getByDisplayValue('test value')).toBeInTheDocument()
    })

    it('should call onChange when value changes', async () => {
      const handleChange = vi.fn()
      render(<Input onChange={handleChange} />)

      const input = screen.getByRole('textbox')
      await userEvent.type(input, 'hello')

      expect(handleChange).toHaveBeenCalled()
    })

    it('should update value on user input', async () => {
      render(<Input />)
      const input = screen.getByRole('textbox')

      await userEvent.type(input, 'hello world')
      expect(input).toHaveValue('hello world')
    })
  })

  describe('disabled state', () => {
    it('should be disabled when disabled prop is true', () => {
      render(<Input disabled />)
      const input = screen.getByRole('textbox')
      expect(input).toBeDisabled()
    })

    it('should apply disabled styles', () => {
      render(<Input disabled />)
      const input = screen.getByRole('textbox')
      expect(input).toHaveClass('disabled:opacity-50')
    })

    it('should not accept input when disabled', async () => {
      render(<Input disabled />)
      const input = screen.getByRole('textbox')

      await userEvent.type(input, 'test')
      expect(input).toHaveValue('')
    })
  })

  describe('readonly state', () => {
    it('should be readonly when readOnly prop is true', () => {
      render(<Input readOnly value="readonly value" />)
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('readonly')
    })
  })

  describe('custom className', () => {
    it('should merge custom className with default classes', () => {
      render(<Input className="custom-input" />)
      const input = screen.getByRole('textbox')
      expect(input).toHaveClass('custom-input')
      expect(input).toHaveClass('flex') // Should still have base classes
    })
  })

  describe('focus behavior', () => {
    it('should be focusable', async () => {
      render(<Input />)
      const input = screen.getByRole('textbox')

      await userEvent.click(input)
      expect(input).toHaveFocus()
    })

    it('should call onFocus when focused', async () => {
      const handleFocus = vi.fn()
      render(<Input onFocus={handleFocus} />)

      const input = screen.getByRole('textbox')
      await userEvent.click(input)

      expect(handleFocus).toHaveBeenCalled()
    })

    it('should call onBlur when blurred', async () => {
      const handleBlur = vi.fn()
      render(<Input onBlur={handleBlur} />)

      const input = screen.getByRole('textbox')
      await userEvent.click(input)
      await userEvent.tab()

      expect(handleBlur).toHaveBeenCalled()
    })
  })

  describe('accessibility', () => {
    it('should support aria-label', () => {
      render(<Input aria-label="Username" />)
      expect(screen.getByLabelText('Username')).toBeInTheDocument()
    })

    it('should support aria-describedby', () => {
      render(
        <>
          <Input aria-describedby="helper-text" />
          <span id="helper-text">Enter your username</span>
        </>
      )
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('aria-describedby', 'helper-text')
    })
  })
})
