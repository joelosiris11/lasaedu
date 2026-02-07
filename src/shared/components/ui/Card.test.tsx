import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from './Card'

describe('Card Components', () => {
  describe('Card', () => {
    it('should render children', () => {
      render(<Card>Card content</Card>)
      expect(screen.getByText('Card content')).toBeInTheDocument()
    })

    it('should apply base classes', () => {
      render(<Card data-testid="card">Content</Card>)
      const card = screen.getByTestId('card')
      expect(card).toHaveClass('rounded-lg', 'border', 'shadow-sm')
    })

    it('should merge custom className', () => {
      render(<Card className="custom-class" data-testid="card">Content</Card>)
      const card = screen.getByTestId('card')
      expect(card).toHaveClass('custom-class')
      expect(card).toHaveClass('rounded-lg') // Base class still present
    })

    it('should forward ref', () => {
      const ref = { current: null }
      render(<Card ref={ref}>Content</Card>)
      expect(ref.current).toBeInstanceOf(HTMLDivElement)
    })
  })

  describe('CardHeader', () => {
    it('should render children', () => {
      render(<CardHeader>Header content</CardHeader>)
      expect(screen.getByText('Header content')).toBeInTheDocument()
    })

    it('should apply padding classes', () => {
      render(<CardHeader data-testid="header">Header</CardHeader>)
      const header = screen.getByTestId('header')
      expect(header).toHaveClass('p-6')
    })

    it('should merge custom className', () => {
      render(<CardHeader className="custom-header" data-testid="header">Header</CardHeader>)
      const header = screen.getByTestId('header')
      expect(header).toHaveClass('custom-header')
    })
  })

  describe('CardTitle', () => {
    it('should render as h3 element', () => {
      render(<CardTitle>Title</CardTitle>)
      expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument()
    })

    it('should render children', () => {
      render(<CardTitle>My Card Title</CardTitle>)
      expect(screen.getByText('My Card Title')).toBeInTheDocument()
    })

    it('should apply text styling classes', () => {
      render(<CardTitle data-testid="title">Title</CardTitle>)
      const title = screen.getByTestId('title')
      expect(title).toHaveClass('text-2xl', 'font-semibold')
    })
  })

  describe('CardDescription', () => {
    it('should render as paragraph element', () => {
      render(<CardDescription>Description</CardDescription>)
      const description = screen.getByText('Description')
      expect(description.tagName).toBe('P')
    })

    it('should render children', () => {
      render(<CardDescription>My description text</CardDescription>)
      expect(screen.getByText('My description text')).toBeInTheDocument()
    })

    it('should apply muted text styling', () => {
      render(<CardDescription data-testid="desc">Description</CardDescription>)
      const desc = screen.getByTestId('desc')
      expect(desc).toHaveClass('text-sm', 'text-muted-foreground')
    })
  })

  describe('CardContent', () => {
    it('should render children', () => {
      render(<CardContent>Content here</CardContent>)
      expect(screen.getByText('Content here')).toBeInTheDocument()
    })

    it('should apply padding classes', () => {
      render(<CardContent data-testid="content">Content</CardContent>)
      const content = screen.getByTestId('content')
      expect(content).toHaveClass('p-6', 'pt-0')
    })
  })

  describe('CardFooter', () => {
    it('should render children', () => {
      render(<CardFooter>Footer content</CardFooter>)
      expect(screen.getByText('Footer content')).toBeInTheDocument()
    })

    it('should apply flex and padding classes', () => {
      render(<CardFooter data-testid="footer">Footer</CardFooter>)
      const footer = screen.getByTestId('footer')
      expect(footer).toHaveClass('flex', 'items-center', 'p-6', 'pt-0')
    })
  })

  describe('Full Card composition', () => {
    it('should render a complete card with all sections', () => {
      render(
        <Card data-testid="full-card">
          <CardHeader>
            <CardTitle>Test Title</CardTitle>
            <CardDescription>Test Description</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Main content goes here</p>
          </CardContent>
          <CardFooter>
            <button>Action</button>
          </CardFooter>
        </Card>
      )

      expect(screen.getByTestId('full-card')).toBeInTheDocument()
      expect(screen.getByText('Test Title')).toBeInTheDocument()
      expect(screen.getByText('Test Description')).toBeInTheDocument()
      expect(screen.getByText('Main content goes here')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument()
    })
  })
})
