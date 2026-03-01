import { useRef, useLayoutEffect } from 'react'
import { gsap } from 'gsap'

interface AnimatedTextProps {
    /** The text content to animate (plain text or HTML string) */
    children: string | number
    /** HTML tag to render */
    as?: 'h1' | 'h2' | 'h3' | 'p' | 'span' | 'div'
    /** CSS class for the wrapper */
    className?: string
    /** Animation trigger key — change this to replay the animation */
    animKey: string | number
    /** 'chars' = per-character (headings), 'words' = per-word (paragraphs) */
    mode?: 'chars' | 'words'
    /** Stagger delay between each unit (seconds) */
    stagger?: number
    /** Base delay before the animation starts (seconds) */
    delay?: number
    /** Animation duration per unit (seconds) */
    duration?: number
    /** 'in' to animate entrance, 'out' to animate exit */
    direction?: 'in' | 'out'
    /** From Y offset in px */
    fromY?: number
    /** If true, treat children as raw HTML */
    html?: boolean
}

/**
 * Split a DOM node's text nodes into word spans, each containing char spans.
 * Preserves inline elements like <span class="highlight">.
 */
function splitIntoWordSpans(el: HTMLElement) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null)
    const textNodes: Text[] = []
    let node = walker.nextNode()
    while (node) {
        textNodes.push(node as Text)
        node = walker.nextNode()
    }

    textNodes.forEach(textNode => {
        const parent = textNode.parentNode
        if (!parent) return
        const text = textNode.textContent || ''
        if (!text.trim()) return

        const frag = document.createDocumentFragment()
        // Split by spaces but keep groups together
        const words = text.split(/(\s+)/)

        words.forEach(part => {
            if (!part) return
            if (/^\s+$/.test(part)) {
                // Whitespace — add a non-animated space
                const space = document.createTextNode(' ')
                frag.appendChild(space)
            } else {
                const wordSpan = document.createElement('span')
                wordSpan.className = 'anim-word-parent'
                wordSpan.style.display = 'inline-block'
                wordSpan.style.whiteSpace = 'nowrap'

                // Split word into characters
                part.split('').forEach(char => {
                    const charSpan = document.createElement('span')
                    charSpan.textContent = char
                    charSpan.className = 'anim-char'
                    charSpan.style.display = 'inline-block'
                    charSpan.style.willChange = 'transform, opacity'
                    wordSpan.appendChild(charSpan)
                })

                frag.appendChild(wordSpan)
            }
        })

        parent.replaceChild(frag, textNode)
    })
}

export function AnimatedText({
    children,
    as: Tag = 'span',
    className = '',
    animKey,
    mode = 'chars',
    stagger = 0.02,
    delay = 0,
    duration = 0.6,
    direction = 'in',
    fromY = 60,
    html = false,
}: AnimatedTextProps) {
    const containerRef = useRef<HTMLElement>(null)
    const tlRef = useRef<gsap.core.Timeline | null>(null)
    const text = String(children ?? '')

    useLayoutEffect(() => {
        const el = containerRef.current
        if (!el) return

        if (tlRef.current) tlRef.current.kill()

        if (mode === 'words') {
            // For words mode (paragraphs), split HTML/Text into word spans, each with char spans
            if (html) {
                el.innerHTML = text
            } else {
                el.textContent = text
            }
            splitIntoWordSpans(el)
        }

        // Both modes now use .anim-char for the actual animation
        const chars = el.querySelectorAll('.anim-char')
        const tl = gsap.timeline({ delay })

        if (direction === 'in') {
            gsap.set(chars, { y: fromY, opacity: 0, rotateX: mode === 'chars' ? -40 : 0 })
            tl.to(chars, {
                y: 0,
                opacity: 1,
                rotateX: 0,
                duration,
                stagger: { each: stagger, ease: 'none' },
                ease: 'power3.out',
            })
        } else {
            tl.to(chars, {
                y: fromY * 0.5,
                opacity: 0,
                rotateX: mode === 'chars' ? 30 : 0,
                duration: duration * 0.5,
                stagger: { each: stagger * 0.4, ease: 'none' },
                ease: 'power2.in',
            })
        }

        tlRef.current = tl

        return () => {
            if (tlRef.current) tlRef.current.kill()
        }
    }, [animKey, direction])

    // Words mode renders empty — content set via useLayoutEffect
    if (mode === 'words') {
        return (
            <Tag
                ref={containerRef as any}
                className={className}
                style={{ display: 'block' }}
            />
        )
    }

    // Chars mode — split text into char spans via JSX
    const words = text.split(' ')
    return (
        <Tag ref={containerRef as any} className={className} style={{ perspective: '800px', display: 'block' }}>
            {words.map((word, wi) => (
                <span key={wi} style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>
                    {word.split('').map((char, ci) => (
                        <span
                            key={ci}
                            className="anim-char"
                            style={{
                                display: 'inline-block',
                                willChange: 'transform, opacity',
                            }}
                        >
                            {char}
                        </span>
                    ))}
                    {wi < words.length - 1 && (
                        <span style={{ display: 'inline-block' }}>&nbsp;</span>
                    )}
                </span>
            ))}
        </Tag>
    )
}
