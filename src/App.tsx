import { useState, useRef, useCallback, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { PresentationControls, Environment, Float, useProgress } from '@react-three/drei'
import * as THREE from 'three'
import { HydrationCan } from './components/HydrationCan'
import { WaterSpiral } from './components/WaterSpiral'
import { AnimatedText } from './components/AnimatedText'
import { Leva, useControls, button } from 'leva'
import { useSpring, animated } from '@react-spring/three'
import yaml from 'js-yaml'
import rawSlides from './data/slides.md?raw'

// ─── Slide Data Parsing ──────────────────────────────────────────────
function parseSlides(mdRaw: string) {
  const blocks = mdRaw.split('===').map(s => s.trim()).filter(Boolean)
  return blocks.map(block => {
    // block typically starts with --- yaml --- \n body
    const parts = block.split('---')
    if (parts.length >= 3) {
      const frontmatter = yaml.load(parts[1]) as any
      const bodyStr = parts[2].trim()
      return {
        ...frontmatter,
        body: bodyStr,
      }
    }
    return { bigNumber: '', body: '', labelGradient: ['#fff', '#fff', '#fff'] }
  })
}

const SLIDES = parseSlides(rawSlides)

// ── Change this to 'x', 'y', or 'z' to pick the spin axis ──
const SPIN_AXIS: 'x' | 'y' | 'z' = 'y'

// ─── Animated Background (HTML Canvas with Liquid Mask) ────────────────
function AnimatedBackground({ prevColor, currentColor, progress }: { prevColor: string, currentColor: string, progress: any }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId: number

    const render = () => {
      // Handle canvas resizing gracefully
      const width = window.innerWidth
      const height = window.innerHeight
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }

      const p = progress.get()

      // Always draw prev color full screen
      ctx.fillStyle = prevColor
      ctx.fillRect(0, 0, width, height)

      // Draw current color masked by expanding wavy circle
      // Use exact same logic as LiquidTexture
      if (p > 0) {
        ctx.save()
        ctx.beginPath()
        const cx = width / 2
        const cy = height / 2
        // Expands to cover the diagonal of the screen
        const maxDist = Math.sqrt(width * width + height * height)
        const baseRadius = p * (maxDist * 1.2)

        for (let i = 0; i <= Math.PI * 2 + 0.05; i += 0.02) {
          const intensity = Math.sin(p * Math.PI) * (maxDist * 0.1) // Scale wiggle by screen size
          const wave1 = Math.sin(i * 3 + p * 15) * intensity
          const wave2 = Math.cos(i * 4 - p * 12) * (intensity * 0.8)
          const wave3 = Math.sin(i * 7 + p * 20) * (intensity * 0.4)

          const r = Math.max(0, baseRadius + wave1 + wave2 + wave3)
          ctx.lineTo(cx + Math.cos(i) * r, cy + Math.sin(i) * r)
        }

        // Apply blurring to the edge
        ctx.filter = 'blur(40px)'
        ctx.fillStyle = currentColor
        ctx.fill()
        ctx.filter = 'none'
        ctx.restore()
      }

      animationFrameId = requestAnimationFrame(render)
    }

    render()

    return () => cancelAnimationFrame(animationFrameId)
  }, [prevColor, currentColor, progress])

  return (
    <canvas
      ref={canvasRef}
      className="animated-bg"
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}
    />
  )
}

// ─── Liquid Texture Animator ─────────────────────────────────────────
function LiquidTexture({ prevSlide, currentSlide, progress, slideCanvases, setTexture }: any) {
  const texRef = useRef<THREE.CanvasTexture | null>(null)

  useEffect(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 2048
    canvas.height = 2048
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.flipY = false
    tex.minFilter = THREE.LinearMipmapLinearFilter
    tex.generateMipmaps = true
    tex.anisotropy = 16 // Set a high anisotropy, WebGL clamps to max supported
    texRef.current = tex
    setTexture(tex)
  }, [setTexture])

  useFrame(() => {
    if (!texRef.current || slideCanvases.length === 0) return
    const p = progress.get()
    const ctx = texRef.current.image.getContext('2d')
    if (!ctx) return

    // Always draw prev slide full screen
    ctx.globalCompositeOperation = 'source-over'
    ctx.drawImage(slideCanvases[prevSlide], 0, 0)

    // Draw current slide masked by a crazy expanding wavy circle
    if (p > 0) {
      // We use a temporary canvas to handle the blurred masking
      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = 2048
      tempCanvas.height = 2048
      const tCtx = tempCanvas.getContext('2d')
      if (tCtx) {
        tCtx.beginPath()
        const cx = 1024
        const cy = 1024
        const baseRadius = p * 2400

        for (let i = 0; i <= Math.PI * 2 + 0.05; i += 0.02) {
          const intensity = Math.sin(p * Math.PI) * 120
          const wave1 = Math.sin(i * 3 + p * 15) * intensity
          const wave2 = Math.cos(i * 4 - p * 12) * (intensity * 0.8)
          const wave3 = Math.sin(i * 7 + p * 20) * (intensity * 0.4)
          const r = Math.max(0, baseRadius + wave1 + wave2 + wave3)
          tCtx.lineTo(cx + Math.cos(i) * r, cy + Math.sin(i) * r)
        }

        // Draw the blurred mask
        tCtx.filter = 'blur(30px)'
        tCtx.fillStyle = 'white'
        tCtx.fill()

        // Mask the current slide image
        tCtx.filter = 'none'
        tCtx.globalCompositeOperation = 'source-in'
        tCtx.drawImage(slideCanvases[currentSlide], 0, 0)

        // Draw masked image onto main texture
        ctx.drawImage(tempCanvas, 0, 0)
      }
    }

    texRef.current.needsUpdate = true
  })

  return null
}

// ─── Branding Components ─────────────────────────────────────────────
function Logo() {
  return (
    <a href="https://hydration.net/" target="_blank" rel="noopener noreferrer" className="app-logo">
      <svg width="101" height="20" viewBox="0 0 101 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g clipPath="url(#clip0_6210_11896)">
          <path d="M36.3546 15.5858C36.3546 15.7123 36.2594 15.7756 36.0524 15.7603C34.908 15.697 33.987 15.697 32.8427 15.7603C32.6357 15.7756 32.5404 15.7123 32.5404 15.5858C32.5404 15.5073 32.6357 15.4114 32.8263 15.3328C33.0967 15.222 33.1603 14.969 33.1603 14.3361V10.9818H28.3174V14.3361C28.3174 14.9696 28.381 15.2227 28.6514 15.3328C28.842 15.4114 28.9373 15.5073 28.9373 15.5858C28.9373 15.7123 28.842 15.7756 28.635 15.7603C27.4907 15.697 26.5696 15.697 25.4253 15.7603C25.2183 15.7756 25.123 15.7123 25.123 15.5858C25.123 15.5073 25.2183 15.4277 25.3935 15.3328C25.6957 15.2216 25.7429 14.969 25.7429 14.3361V5.71157C25.7429 5.07906 25.6957 4.82504 25.3935 4.71486C25.2183 4.63529 25.123 4.54041 25.123 4.46186C25.123 4.33535 25.2183 4.2721 25.4253 4.28741C26.5696 4.35066 27.4907 4.35066 28.635 4.28741C28.842 4.2721 28.9373 4.33535 28.9373 4.46186C28.9373 4.54143 28.842 4.63631 28.6514 4.71486C28.381 4.82504 28.3174 5.07906 28.3174 5.71157V10.3319H33.1603V5.71157C33.1603 5.07906 33.0967 4.82504 32.8263 4.71486C32.6357 4.63529 32.5404 4.54041 32.5404 4.46186C32.5404 4.33535 32.6357 4.2721 32.8427 4.28741C33.987 4.35066 34.908 4.35066 36.0524 4.28741C36.2594 4.2721 36.3546 4.33535 36.3546 4.46186C36.3546 4.54143 36.2594 4.63631 36.0688 4.71486C35.7983 4.82504 35.7348 5.07906 35.7348 5.71157V14.3351C35.7348 14.9686 35.7983 15.2216 36.0688 15.3318C36.2594 15.4104 36.3546 15.5063 36.3546 15.5848V15.5858Z" fill="white" />
          <path d="M45.8103 6.89895C45.8103 7.02546 45.7314 7.10503 45.5716 7.15196C45.2059 7.21521 44.8565 7.64266 44.5543 8.44962L41.6939 15.6184C41.4869 16.1091 41.3128 16.4886 41.1693 16.7895C41.0259 17.0905 40.82 17.4067 40.5813 17.7393C40.0885 18.4198 39.4687 18.736 38.6901 18.7993C37.8961 18.8778 37.3398 18.6728 37.0211 18.1821C36.7824 17.8179 36.7824 17.4853 37.0211 17.1854C37.1 17.0905 37.1963 17.0109 37.3234 16.9477C37.9596 16.71 38.102 16.8212 38.5466 17.0262C38.7853 17.1374 38.9595 17.2007 39.1029 17.216C39.7863 17.2792 40.3579 16.8201 40.7872 15.8551L37.3551 8.16499C37.1011 7.59573 37.0693 7.50086 36.9259 7.35803C36.8623 7.27948 36.7824 7.21521 36.6882 7.16828C36.4976 7.08871 36.4023 6.99383 36.4023 6.89895C36.4023 6.78776 36.4976 6.7245 36.7046 6.74083C37.9125 6.80408 38.7382 6.80408 39.9461 6.74083C40.153 6.7245 40.2483 6.78776 40.2483 6.89895C40.2483 6.99383 40.153 7.08871 39.9625 7.16828C39.6603 7.27948 39.6766 7.53248 39.9307 8.16499L41.8537 13.1649C43.0134 10.3012 43.6333 8.71895 43.7449 8.44962C44.0625 7.67429 43.999 7.24683 43.5544 7.16828C43.1733 7.05708 43.1733 6.74083 43.5708 6.74083C44.1107 6.77245 44.46 6.78776 44.6035 6.78776C44.7151 6.78776 45.0163 6.77245 45.5255 6.74083C45.7161 6.7245 45.8114 6.78776 45.8114 6.89895H45.8103Z" fill="white" />
          <path d="M54.9477 15.4597C54.9477 15.5709 54.8524 15.6342 54.6455 15.6342C53.5492 15.6658 52.7389 15.7127 52.1979 15.777C52.0074 15.8086 51.9121 15.7137 51.9121 15.5077V14.3049C51.324 15.4128 50.3702 15.9657 49.0681 15.9657C47.8448 15.9657 46.8593 15.5066 46.1442 14.5895C45.4291 13.6714 45.0951 12.4216 45.1432 10.8557C45.1914 9.41519 45.636 8.3083 46.4935 7.53297C47.3674 6.75764 48.4319 6.44139 49.7197 6.58319C50.7206 6.69439 51.4521 7.18407 51.9131 8.03898V6.47199C51.9131 5.90273 51.8014 5.57016 51.5791 5.47528C51.3886 5.39673 51.2933 5.31715 51.2933 5.20595C51.2933 5.09476 51.3886 4.99988 51.5638 4.93663C52.4541 4.7785 53.2798 4.50918 54.0267 4.12967C54.1701 4.0501 54.3125 4.11335 54.3125 4.2878V14.2253C54.3125 14.8425 54.3924 15.0955 54.6619 15.2067C54.8524 15.2853 54.9477 15.3812 54.9477 15.4597ZM51.9439 11.5045V10.7761C51.8803 8.48173 50.9747 7.27895 49.6234 7.3422C48.9871 7.3575 48.4954 7.75333 48.1296 8.51336C47.7639 9.27339 47.6051 10.2221 47.6215 11.3617C47.6379 12.5165 47.8602 13.4031 48.3048 14.0519C48.7495 14.6854 49.2904 14.9853 49.9256 14.9537C51.1335 14.9068 51.8803 13.704 51.9439 11.5045Z" fill="white" />
          <path d="M62.5745 7.48485C62.8132 7.97555 62.8132 8.41831 62.5427 8.84576C62.3358 9.17834 62.0346 9.35177 61.6207 9.33647C61.0644 9.33647 60.7939 8.92534 60.715 8.54583C60.6515 8.15 60.3493 7.73887 59.7612 7.73887C59.0144 7.73887 58.6333 8.53053 58.6333 10.0965V14.3374C58.6333 14.9709 58.7767 15.2392 59.1732 15.3504C59.3801 15.4136 59.4754 15.4932 59.4754 15.5881C59.4754 15.7146 59.3637 15.7778 59.1578 15.7625C57.9499 15.6993 57.0443 15.6993 55.8999 15.7625C55.6929 15.7778 55.5977 15.7146 55.5977 15.5881C55.5977 15.5095 55.6929 15.4136 55.8835 15.3351C56.1222 15.2565 56.2328 14.924 56.2328 14.3384V9.06918C56.2328 8.49992 56.1222 8.16735 55.8835 8.07247C55.6929 7.99392 55.5977 7.91434 55.5977 7.80314C55.5977 7.69195 55.6765 7.61339 55.82 7.58177C56.6304 7.40732 57.4243 7.13901 58.1876 6.74318C58.3628 6.64831 58.4734 6.69524 58.4898 6.90131L58.6015 8.18265V8.2306C58.9826 7.10739 59.6823 6.53711 60.715 6.53711C61.6525 6.53711 62.2723 6.85336 62.5745 7.48689V7.48485Z" fill="white" />
          <path d="M71.1718 15.5545C71.1718 15.6973 71.0602 15.7606 70.8542 15.7606H70.6791C70.2498 15.7606 70.2344 15.7606 69.8052 15.7126C69.5982 15.6973 69.424 15.6494 69.3124 15.6014C68.9149 15.3801 68.4856 15.0791 68.3432 14.3354C67.8351 15.3637 66.6907 15.9656 65.4346 15.9656C63.7022 15.9656 62.7013 15.0638 62.6542 13.7825C62.5589 11.8839 64.2913 11.0453 65.7686 10.7128C66.786 10.4434 67.9139 10.1751 68.2951 9.87419V9.62118C68.2951 7.76957 68.0092 6.94731 66.9284 6.94731C64.7995 6.94731 66.3249 9.60588 64.402 9.49468C63.9727 9.47938 63.7022 9.25698 63.5752 8.86115C63.4164 8.38677 63.5434 7.92769 63.9727 7.46862C64.5761 6.85141 65.5617 6.53516 66.9284 6.53516C69.4077 6.53516 70.6627 7.56349 70.6627 9.84256C70.6627 9.98539 70.6627 10.6495 70.678 11.836C70.6934 13.0224 70.6934 13.7825 70.6934 14.115C70.6934 14.7486 70.7569 15.1281 70.884 15.2699C71.011 15.3964 71.1698 15.428 71.1698 15.5545H71.1718ZM68.2797 12.9439L68.2951 10.6332C68.1516 10.7281 67.8658 10.8709 67.4365 11.0443C67.0073 11.2188 66.6425 11.3922 66.3085 11.5503C65.6723 11.8666 65.0218 12.5634 65.0853 13.4336C65.1324 14.1773 65.7369 14.62 66.4991 14.6047C67.58 14.6047 68.2787 13.8294 68.2787 12.9429L68.2797 12.9439Z" fill="white" />
          <path d="M76.1773 15.127C75.7798 15.6646 75.1764 15.9339 74.366 15.9339C72.984 15.9339 72.3006 15.2371 72.3006 13.8456V7.38895H71.7443C71.5701 7.38895 71.4902 7.27877 71.4902 7.05637C71.4902 6.80337 71.5384 6.74011 71.7443 6.74011H71.9513C72.4123 6.74011 72.8569 6.56567 73.2698 6.23411C73.6991 5.88623 73.9849 5.47408 74.1437 4.9844C74.1908 4.84157 74.2871 4.77832 74.4295 4.77832C74.6047 4.77832 74.7 4.85687 74.7 5.03132V6.74011H75.9714C76.1302 6.74011 76.2101 6.85029 76.2101 7.05637C76.2101 7.27775 76.1312 7.38895 75.9714 7.38895H74.7V13.9558C74.7 14.573 74.8588 14.9056 75.1928 14.9688C75.2881 14.9841 75.5104 14.9372 75.8444 14.826C76.0195 14.7311 76.1302 14.7148 76.1937 14.7791C76.2726 14.8576 76.2726 14.9688 76.1783 15.127H76.1773Z" fill="white" />
          <path d="M80.5949 15.5862C80.5949 15.7127 80.4996 15.7759 80.2926 15.7606C79.721 15.729 79.2118 15.7127 78.7672 15.7127C78.2908 15.7127 77.7816 15.728 77.2417 15.7606C77.0347 15.7759 76.9395 15.7127 76.9395 15.5862C76.9395 15.5076 77.0347 15.4117 77.2253 15.3332C77.4958 15.222 77.5593 14.969 77.5593 14.3365V9.08258C77.5593 8.46537 77.4958 8.21237 77.2253 8.08587C77.0347 8.00731 76.9395 7.92774 76.9395 7.81654C76.9395 7.70534 77.0347 7.61047 77.2253 7.54721C78.1156 7.37276 78.926 7.10446 79.6728 6.74026C79.8798 6.64538 79.975 6.69231 79.975 6.89838V14.3355C79.975 14.969 80.0386 15.222 80.309 15.3322C80.4996 15.4107 80.5949 15.5066 80.5949 15.5852V15.5862ZM77.5439 5.66499C76.9241 5.15899 76.9241 4.33571 77.5439 3.8297C78.1637 3.32369 79.1493 3.32369 79.7681 3.8297C80.3879 4.33571 80.3879 5.15899 79.7681 5.66499C79.1483 6.1557 78.1627 6.1557 77.5439 5.66499Z" fill="white" />
          <path d="M89.2239 7.89607C90.0824 8.7979 90.5106 9.92111 90.5106 11.2504C90.5106 12.5797 90.0814 13.7192 89.2239 14.6211C88.3817 15.5229 87.2538 15.9656 85.8707 15.9656C84.4876 15.9656 83.3596 15.5229 82.5175 14.6211C81.6754 13.7192 81.2461 12.596 81.2461 11.2504C81.2615 9.90581 81.6907 8.7979 82.5329 7.89607C83.375 6.99423 84.4876 6.53516 85.8697 6.53516C87.2517 6.53516 88.3807 6.99423 89.2229 7.89607H89.2239ZM83.7418 11.6146C83.9487 12.8011 84.3134 13.7508 84.838 14.4946C85.3625 15.2383 85.9824 15.5392 86.6975 15.428C88.143 15.1434 88.3981 13.0704 88.016 10.8862C87.809 9.69974 87.4443 8.74995 86.9198 8.00625C86.3952 7.26254 85.7754 6.96159 85.0767 7.07279C83.583 7.35742 83.3443 9.43041 83.7418 11.6146Z" fill="white" />
          <path d="M100.841 15.5861C100.841 15.7126 100.745 15.7759 100.538 15.7606C99.4576 15.6973 98.5683 15.6973 97.4875 15.7606C97.2805 15.7759 97.1852 15.7126 97.1852 15.5861C97.1852 15.5076 97.2805 15.4117 97.4711 15.3331C97.7415 15.2219 97.805 14.9689 97.805 14.3364V10.3016C97.805 8.56122 97.217 7.69101 96.0409 7.69101C95.3893 7.69101 94.8965 7.94402 94.5625 8.45002C94.2285 8.94073 94.0697 9.54161 94.0697 10.2221V14.3364C94.0697 14.922 94.1804 15.2546 94.4191 15.3331C94.5943 15.4117 94.6895 15.5076 94.6895 15.5861C94.6895 15.7126 94.5943 15.7759 94.3873 15.7606C93.8792 15.729 93.37 15.7126 92.8782 15.7126C92.3865 15.7126 91.8927 15.7279 91.3527 15.7606C91.1458 15.7759 91.0505 15.7126 91.0505 15.5861C91.0505 15.5076 91.1458 15.428 91.321 15.3331C91.5597 15.2546 91.6703 14.922 91.6703 14.3364V9.06723C91.6703 8.49797 91.5597 8.16539 91.321 8.07052C91.1304 7.99196 91.0352 7.91239 91.0352 7.80119C91.0352 7.68999 91.114 7.61144 91.2575 7.57981C92.0679 7.40537 92.8618 7.13706 93.6251 6.74123C93.8003 6.64636 93.9109 6.69328 93.9273 6.89936L94.039 8.1807L94.0544 8.33882C94.6107 7.13604 95.5798 6.53516 96.9465 6.53516C99.2189 6.53516 100.22 7.75324 100.22 10.3016V14.3364C100.22 14.97 100.283 15.223 100.554 15.3331C100.744 15.4117 100.84 15.5076 100.84 15.5861H100.841Z" fill="white" />
          <path d="M18.0532 11.3594C18.2827 11.1309 18.5778 10.8371 18.8718 10.5453C19.5265 9.89446 19.5265 8.83756 18.8718 8.18567L18.1782 7.49501C15.6959 9.96689 11.982 10.4627 9.00484 8.98548C11.017 9.3558 13.1028 9.0671 14.951 8.07753C16.1876 7.41543 16.4222 5.74643 15.4295 4.75788L11.3366 0.682285C10.4217 -0.22873 8.93928 -0.22873 8.02542 0.682285L3.61392 5.07515C6.51941 3.84584 10.0089 4.41612 12.3714 6.78497C8.76716 5.04251 4.30136 5.66073 1.3088 8.64066C1.07931 8.86918 0.78323 9.16401 0.490223 9.45578C-0.163408 10.1077 -0.163408 11.1636 0.490223 11.8144L1.18279 12.5041C3.66515 10.0322 7.37896 9.53638 10.3562 11.0136C8.34404 10.6433 6.25816 10.932 4.40996 11.9215C3.17339 12.5836 2.93878 14.2526 3.93152 15.2412L8.0244 19.3168C8.93928 20.2278 10.4217 20.2278 11.3356 19.3168L15.7471 14.9239C12.8416 16.1532 9.35215 15.5829 6.98965 13.2141C10.5938 14.9566 15.0596 14.3383 18.0522 11.3584L18.0532 11.3594Z" fill="white" />
        </g>
        <defs>
          <clipPath id="clip0_6210_11896">
            <rect width="100.841" height="20.0005" fill="white" />
          </clipPath>
        </defs>
      </svg>
    </a>
  )
}

function Credits() {
  return (
    <div className="app-credits">
      <a href="https://samborek.xyz/" target="_blank" rel="noopener noreferrer">
        made by sambø
      </a>
    </div>
  )
}

// ─── Preloader ───────────────────────────────────────────────────────
function Preloader({ isReady, needsReload, setNeedsReload }: { isReady: boolean, needsReload: boolean, setNeedsReload: (v: boolean) => void }) {
  const { progress } = useProgress()
  const [hidden, setHidden] = useState(false)
  const [fade, setFade] = useState(false)

  // Reset when a reload is requested
  useEffect(() => {
    if (needsReload) {
      setHidden(false)
      setFade(false)

      // Auto-clear needsReload after a moment so it doesn't block completion permanently if progress is already 100
      const t = setTimeout(() => setNeedsReload(false), 100)
      return () => clearTimeout(t)
    }
  }, [needsReload, setNeedsReload])

  const complete = progress >= 100 && isReady && !needsReload

  useEffect(() => {
    if (complete) {
      setFade(true)
      const timer = setTimeout(() => {
        setHidden(true)
      }, 1200)
      return () => clearTimeout(timer)
    }
  }, [complete])

  if (hidden) return null

  return (
    <div className={`app-preloader ${fade ? 'fade-out' : ''}`}>
      <div className="preloader-blobs">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
      </div>
      <div className="preloader-content">
        <div className="preloader-title">H Y D R A T I O N</div>
        <div className="progress-bar-container">
          <div className="progress-bar-fill" style={{ width: `${Math.max(progress, 5)}%` }} />
        </div>
      </div>
    </div>
  )
}

// ─── Main Scene ──────────────────────────────────────────────────────
function Scene() {
  const [texture, setTexture] = useState<THREE.Texture | null>(null)
  const [currentSlide, setCurrentSlide] = useState(0)
  const currentSlideRef = useRef(0)
  const [prevSlide, setPrevSlide] = useState(0)

  useEffect(() => {
    currentSlideRef.current = currentSlide
  }, [currentSlide])

  const [spinCount, setSpinCount] = useState(0)
  const { transitionProgress } = useSpring({
    transitionProgress: currentSlide === prevSlide ? 0 : 1,
    config: { tension: 80, friction: 18 }, // Smoothed out
    onRest: () => {
      setPrevSlide(currentSlideRef.current)
    }
  })
  const { spinY } = useSpring({
    spinY: spinCount * Math.PI * 2,
    config: { tension: 60, friction: 18 },
  })
  const [textAnimClass, setTextAnimClass] = useState('')
  const [textDirection, setTextDirection] = useState<'in' | 'out'>('in')
  const [textAnimKey, setTextAnimKey] = useState(0)

  const [needsReload, setNeedsReload] = useState(false)

  // ─── Mobile viewport detection ─────────────────────────────────────
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    let resizeTimer: number
    const onResize = () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        const currentlyMobile = window.innerWidth < 768
        setIsMobile(prev => {
          if (prev !== currentlyMobile) {
            setNeedsReload(true)
            return currentlyMobile
          }
          return prev
        })
      }, 150)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Load saved settings from local storage
  // Clear legacy cached canPositionX so centering takes effect
  useEffect(() => {
    const stored = localStorage.getItem('hydration-can-settings')
    if (stored) {
      const parsed = JSON.parse(stored)
      let changed = false
      if (parsed.canPositionX !== undefined && parsed.canPositionX !== 0) {
        parsed.canPositionX = 0
        changed = true
      }
      if (changed) {
        localStorage.setItem('hydration-can-settings', JSON.stringify(parsed))
      }
    }
  }, [])

  const savedSettingsStr = localStorage.getItem('hydration-can-settings')
  const savedSettings = savedSettingsStr ? JSON.parse(savedSettingsStr) : {}
  const getSaved = (key: string, defaultVal: any) => savedSettings[key] !== undefined ? savedSettings[key] : defaultVal

  // --- Settings History State ---
  const [history, setHistory] = useState<{ name: string, data: any }[]>(() => {
    const h = localStorage.getItem('hydration-can-history')
    return h ? JSON.parse(h) : []
  })

  console.log("--- DEBUG INIT ---", { loadedWaterX: getSaved('waterPositionX', 6.199999999999999) })

  const canSettings = useControls('Can Animation & Position', {
    canRotation: { value: getSaved('canRotation', [7.9, 2.7, 3.1]), step: 0.1 },
    canPositionX: { value: 0, min: -10, max: 10, step: 0.1 },
    canPositionY: { value: getSaved('canPositionY', 0.3), min: -10, max: 10, step: 0.1 },
    canScale: { value: getSaved('canScale', 0.5), min: 0.1, max: 5, step: 0.05 },
    floatSpeed: { value: getSaved('floatSpeed', 2.6), min: 0, max: 10 },
    floatIntensity: { value: getSaved('floatIntensity', 0), min: 0, max: 10 },
    textPadding: { value: getSaved('textPadding', 480), min: 0, max: 1000, step: 10 },
    dragSpeed: { value: getSaved('dragSpeed', 1.6), min: 0.1, max: 10.0, step: 0.1 },
    textLineHeight: { value: getSaved('textLineHeight', 0.9), min: 0.1, max: 3.0, step: 0.05 },
    textSidePadding: { value: getSaved('textSidePadding', 60), min: 0, max: 300, step: 5 }
  })

  const { canRotation, canPositionX, canPositionY, canScale, floatSpeed, floatIntensity, textPadding, dragSpeed, textLineHeight, textSidePadding } = canSettings

  const lightSettings = useControls('Area Lights', {
    light1Color: getSaved('light1Color', "#ffffff"),
    light1Intensity: { value: getSaved('light1Intensity', 16.5), min: 0, max: 50 },
    light1Pos: { value: getSaved('light1Pos', [-10.5, 15, 7]), step: 0.5 },
    light1Scale: { value: getSaved('light1Scale', [5, 5]), step: 0.5 },
    light2Color: getSaved('light2Color', "#ffffff"),
    light2Intensity: { value: getSaved('light2Intensity', 29.5), min: 0, max: 50 },
    light2Pos: { value: getSaved('light2Pos', [-4, -8, 13]), step: 0.5 },
    light2Scale: { value: getSaved('light2Scale', [5, 5]), step: 0.5 },
  })

  const { light1Color, light1Intensity, light1Pos, light1Scale, light2Color, light2Intensity, light2Pos, light2Scale } = lightSettings

  const envSettings = useControls('Environment & Background', {
    envPreset: {
      options: ['apartment', 'city', 'dawn', 'forest', 'lobby', 'night', 'park', 'studio', 'sunset', 'warehouse'],
      value: getSaved('envPreset', "studio")
    },
    envIntensity: { value: getSaved('envIntensity', 0.2), min: 0, max: 5 },
    envRotation: { value: getSaved('envRotation', [13.2, 4.7, -0.8]), step: 0.1 }
  })

  const { envPreset, envIntensity, envRotation } = envSettings

  const filterSettings = useControls('Label Filters', {
    enableFilters: { value: getSaved('enableFilters', false) },
    labelSaturation: { value: getSaved('labelSaturation', 140), min: 0, max: 200, render: (get) => get('Label Filters.enableFilters') },
    labelHue: { value: getSaved('labelHue', -4), min: -180, max: 180, render: (get) => get('Label Filters.enableFilters') },
    labelBrightness: { value: getSaved('labelBrightness', 98), min: 0, max: 200, render: (get) => get('Label Filters.enableFilters') },
    labelContrast: { value: getSaved('labelContrast', 140), min: 0, max: 200, render: (get) => get('Label Filters.enableFilters') },
  })

  // ─── Water Spiral controls (extracted from component for persistence) ───
  const waterSpiralSettings = useControls('Water Spiral', {
    waterVisible: getSaved('waterVisible', true),
    waterNumDroplets: { value: getSaved('waterNumDroplets', 83), min: 10, max: 400, step: 1 },
    waterRadius: { value: getSaved('waterRadius', 0.42), min: 0.01, max: 2.0, step: 0.01 },
    waterHeight: { value: getSaved('waterHeight', 1.33), min: 0.1, max: 5.0, step: 0.01 },
    waterSpeed: { value: getSaved('waterSpeed', 0.2799999999999999), min: 0, max: 10.0, step: 0.01 },
    waterMarchingScale: { value: getSaved('waterMarchingScale', 8), min: 1, max: 100, step: 0.5 },
    waterResolution: { value: getSaved('waterResolution', 84), min: 20, max: 150, step: 1 },
    waterIsolation: { value: getSaved('waterIsolation', 104), min: 10, max: 500, step: 1 },
    waterBlobStrength: { value: getSaved('waterBlobStrength', 0.11), min: 0.01, max: 2.0, step: 0.01 },
    waterBlobSubtract: { value: getSaved('waterBlobSubtract', 9), min: 0, max: 100, step: 1 },
    waterNoiseScale: { value: getSaved('waterNoiseScale', 0.092), min: 0, max: 1.0, step: 0.001 },
    waterRotationSpeed: { value: getSaved('waterRotationSpeed', 0.2), min: -20, max: 20, step: 0.1 },
    waterSpiralTwists: { value: getSaved('waterSpiralTwists', 1.7), min: 0.1, max: 20, step: 0.1 },
    waterPositionX: { value: getSaved('waterPositionX', 6.199999999999999), min: -50, max: 50, step: 0.1 },
    waterPositionY: { value: getSaved('waterPositionY', 5.8999999999999995), min: -50, max: 50, step: 0.1 },
    waterPositionZ: { value: getSaved('waterPositionZ', 7.099999999999999), min: -50, max: 50, step: 0.1 },
    waterDistortionStrength: { value: getSaved('waterDistortionStrength', 0), min: 0, max: 50.0, step: 0.1 },
    waterDistortionArea: { value: getSaved('waterDistortionArea', 0.05), min: 0.01, max: 2.0, step: 0.01 },
  })

  const waterMaterialSettings = useControls('Water Material', {
    waterColor: getSaved('waterColor', "#ffffff"),
    waterTransmission: { value: getSaved('waterTransmission', 1), min: 0, max: 1, step: 0.01 },
    waterRoughness: { value: getSaved('waterRoughness', 0.02), min: 0, max: 1, step: 0.01 },
    waterMetalness: { value: getSaved('waterMetalness', 0), min: 0, max: 1, step: 0.01 },
    waterThickness: { value: getSaved('waterThickness', 0.3), min: 0, max: 10, step: 0.1 },
    waterIor: { value: getSaved('waterIor', 1.17), min: 1, max: 2.5, step: 0.01 },
    waterEnvMapIntensity: { value: getSaved('waterEnvMapIntensity', 2.1), min: 0, max: 10, step: 0.1 },
    waterClearcoat: { value: getSaved('waterClearcoat', 0.6), min: 0, max: 1, step: 0.01 },
    waterClearcoatRoughness: { value: getSaved('waterClearcoatRoughness', 0), min: 0, max: 1, step: 0.01 },
    waterSpecularIntensity: { value: getSaved('waterSpecularIntensity', 2), min: 0, max: 10, step: 0.1 },
    waterSpecularColor: getSaved('waterSpecularColor', "#f7edff"),
    waterAttenuationColor: getSaved('waterAttenuationColor', "#b5ddff"),
    waterAttenuationDistance: { value: getSaved('waterAttenuationDistance', 30), min: 0.1, max: 100, step: 0.5 },
    waterOpacity: { value: getSaved('waterOpacity', 0.86), min: 0, max: 1, step: 0.01 },
    waterTransparent: getSaved('waterTransparent', true),
    waterBlending: { value: getSaved('waterBlending', 1), min: 0, max: 5, step: 1 },
    waterDepthWrite: getSaved('waterDepthWrite', true),
  })

  const { enableFilters, labelSaturation, labelHue, labelBrightness, labelContrast } = filterSettings

  // Combine all current settings for saving
  const currentSettings = {
    ...canSettings,
    ...lightSettings,
    ...envSettings,
    ...filterSettings,
    ...waterSpiralSettings,
    ...waterMaterialSettings
  }

  // Handle autosave effect
  useEffect(() => {
    localStorage.setItem('hydration-can-settings', JSON.stringify(currentSettings))
  }, [currentSettings])

  // --- Dynamic History Controls ---
  useControls('Controls & History', () => {
    const defaultControls: any = {
      'Export Defaults': button(() => {
        const data = localStorage.getItem('hydration-can-settings')
        const materialData = localStorage.getItem('hydration-can-material-settings')

        if (data || materialData) {
          const combined = {
            ...(data ? JSON.parse(data) : {}),
            ...(materialData ? JSON.parse(materialData) : {})
          }
          const exportedStr = JSON.stringify(combined)
          console.log('--- CURRENT LEVA DEFAULT SETTINGS ---', combined)
          navigator.clipboard.writeText(exportedStr).then(() => {
            alert('Settings copied to clipboard!\nYou can paste them over the getSaved() defaults in App.tsx and HydrationCan.tsx')
          }).catch(err => console.error('Failed to copy', err))
        } else {
          alert('No settings saved yet!')
        }
      }),
      'Save Current': button(() => {
        const adjectives = ['Cool', 'Wild', 'Deep', 'Fast', 'Neon', 'Dark', 'Light', 'Smooth', 'Sharp', 'Crazy']
        const nouns = ['Water', 'Spiral', 'Vibe', 'Flow', 'Wave', 'Drop', 'Spin', 'Splash', 'Glow', 'Can']
        const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)]
        const randomNoun = nouns[Math.floor(Math.random() * nouns.length)]
        const randomName = `${randomAdjective} ${randomNoun} ${Math.floor(Math.random() * 100)}`

        const newHistory = [...history, { name: randomName, data: currentSettings }]
        setHistory(newHistory)
        const serialized = JSON.stringify(newHistory)
        try {
          localStorage.setItem('hydration-can-history', serialized)
          // Warn if localStorage usage is getting high (> 4MB)
          const totalSize = Object.keys(localStorage).reduce((sum, key) => sum + (localStorage.getItem(key)?.length || 0), 0)
          if (totalSize > 4 * 1024 * 1024) {
            alert(`⚠️ Storage is getting full (${(totalSize / 1024 / 1024).toFixed(1)}MB used). Consider clearing old snapshots.`)
          }
        } catch (e) {
          alert('⚠️ Storage is full! Please clear some snapshots before saving more.')
        }
      }),
      'Reset to Defaults': button(() => {
        if (confirm('This will wipe all your custom tweaks and reset everything to the hardcoded defaults. Proceed?')) {
          localStorage.removeItem('hydration-can-settings')
          localStorage.removeItem('hydration-can-material-settings')
          window.location.reload()
        }
      })
    }

    // Generate a Load button for every saved history state
    const historyControls = history.reduce((acc, state) => {
      acc[`Load: ${state.name}`] = button(() => {
        if (confirm(`Load layout "${state.name}"?\nThis will overwrite current settings and reload the page.`)) {
          localStorage.setItem('hydration-can-settings', JSON.stringify(state.data))
          window.location.reload()
        }
      })
      return acc
    }, {} as any)

    // Option to clear history
    if (history.length > 0) {
      historyControls['Clear History'] = button(() => {
        if (confirm('Are you sure you want to delete all saved layouts?')) {
          setHistory([])
          localStorage.removeItem('hydration-can-history')
        }
      })
    }

    return { ...defaultControls, ...historyControls }
  }, [history, currentSettings])



  // Load slide label images and create canvases
  const [slideCanvases, setSlideCanvases] = useState<HTMLCanvasElement[]>([])

  useEffect(() => {
    let cancelled = false

    async function loadSlideImages() {
      const canvases = await Promise.all(
        SLIDES.map(async (slide: any) => {
          const canvas = document.createElement('canvas')
          canvas.width = 2048
          canvas.height = 2048
          const ctx = canvas.getContext('2d')!

          if (slide.labelImage) {
            // Load the image from the path
            const img = await new Promise<HTMLImageElement>((resolve, reject) => {
              const el = new Image()
              el.onload = () => resolve(el)
              el.onerror = reject
              el.src = slide.labelImage
            })
            if (enableFilters) {
              ctx.filter = `saturate(${labelSaturation}%) hue-rotate(${labelHue}deg) brightness(${labelBrightness}%) contrast(${labelContrast}%)`
            } else {
              ctx.filter = 'none'
            }
            ctx.drawImage(img, 0, 0, 2048, 2048)
          } else if (slide.labelGradient) {
            // Fallback: gradient
            const grad = ctx.createLinearGradient(0, 0, 2048, 2048)
            grad.addColorStop(0, slide.labelGradient[0])
            grad.addColorStop(0.5, slide.labelGradient[1])
            grad.addColorStop(1, slide.labelGradient[2])
            ctx.fillStyle = grad
            ctx.fillRect(0, 0, 2048, 2048)
          }

          return canvas
        })
      )

      if (!cancelled) setSlideCanvases(canvases)
    }

    loadSlideImages()
    return () => { cancelled = true }
  }, [enableFilters, labelSaturation, labelHue, labelBrightness, labelContrast, isMobile])

  // ─── Slide Navigation ──────────────────────────────────────────────
  const lastNavTime = useRef(0)
  const goToSlide = useCallback((dir: number) => {
    const now = Date.now()
    if (now - lastNavTime.current < 600) return // short cooldown
    lastNavTime.current = now

    setTextDirection('out')
    setTextAnimKey(prev => prev + 1)
    setTextAnimClass('text-exit')
    setSpinCount(prev => prev + dir)

    setTimeout(() => {
      setCurrentSlide(prev => {
        const next = prev + dir
        if (next < 0) return SLIDES.length - 1
        if (next >= SLIDES.length) return 0
        return next
      })
      setTextDirection('in')
      setTextAnimKey(prev => prev + 1)
      setTextAnimClass('text-enter')
    }, 300) // swap label mid-spin (when can faces away)

    setTimeout(() => {
      setTextAnimClass('')
    }, 1200)
  }, [currentSlide, prevSlide])

  // ─── Keyboard Navigation ──────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goToSlide(-1)
      if (e.key === 'ArrowRight') goToSlide(1)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [goToSlide])

  const slide = SLIDES[currentSlide]

  return (
    <div style={{ position: 'relative', width: '100%', height: '100dvh', overflow: 'hidden' }}>
      <Leva collapsed={false} hidden={import.meta.env.PROD} />
      <Logo />
      <Credits />

      {/* Layer 0: Animated background */}
      <AnimatedBackground
        prevColor={SLIDES[prevSlide]?.bgColor || '#000000'}
        currentColor={slide.bgColor || '#000000'}
        progress={transitionProgress}
      />

      <Preloader isReady={slideCanvases.length > 0} needsReload={needsReload} setNeedsReload={setNeedsReload} />

      <div
        className="app-ui-container"
        style={{
          '--color-h1': SLIDES[currentSlide].colorH1,
          '--color-p': SLIDES[currentSlide].colorP,
          '--color-highlight': SLIDES[currentSlide].colorHighlight,
          '--color-footer': SLIDES[currentSlide].colorFooter,
          '--color-btn-bg': SLIDES[currentSlide].colorBtnBg,
          '--color-btn-text': SLIDES[currentSlide].colorBtnText,
          '--color-link': SLIDES[currentSlide].colorLink,
          '--can-scale': canScale,
          '--text-padding': `${textPadding}px`,
          '--text-line-height': textLineHeight,
          '--text-side-padding': `${textSidePadding}px`,
        } as React.CSSProperties}
      >
        {/* Layer 1: Typography flanking the can */}
        <div className="scene-container">
          <div className={`text-left ${textAnimClass}`}>
            <AnimatedText
              as="h1"
              animKey={textAnimKey}
              direction={textDirection}
              mode="words"
              stagger={0.08}
              duration={0.7}
              fromY={80}
              delay={0}
              html
            >
              {slide.bigNumber}
            </AnimatedText>
          </div>
          <div className={`text-right ${textAnimClass}`}>
            <AnimatedText
              as="p"
              animKey={textAnimKey}
              direction={textDirection}
              mode="words"
              stagger={0.012}
              duration={0.5}
              fromY={40}
              delay={0.1}
              html
            >
              {slide.body}
            </AnimatedText>
          </div>
        </div>

        {/* Layer 5: 3D Canvas (transparent, can only) */}
        <div className="scene-container" style={{ zIndex: 5 }}>
          <Canvas camera={{ position: [0, 0, 12], fov: isMobile ? 55 : 45 }} gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }} dpr={isMobile ? 1 : [1, 2]} style={{ width: '100%', height: '100%', pointerEvents: 'auto' }}>

            <ambientLight intensity={0.5} />
            <rectAreaLight
              position={light1Pos as [number, number, number]}
              width={(light1Scale as any)[0]} height={(light1Scale as any)[1]}
              intensity={light1Intensity as unknown as number} color={light1Color as string}
              lookAt={[canPositionX as unknown as number, 0, 0] as any}
            />
            <rectAreaLight
              position={light2Pos as [number, number, number]}
              width={(light2Scale as any)[0]} height={(light2Scale as any)[1]}
              intensity={light2Intensity as unknown as number} color={light2Color as string}
              lookAt={[canPositionX as unknown as number, 0, 0] as any}
            />

            <Environment preset={envPreset as any} environmentIntensity={envIntensity as unknown as number} environmentRotation={envRotation as any} />

            {/* Floating and spinning */}
            <Float speed={floatSpeed as unknown as number} rotationIntensity={1} floatIntensity={floatIntensity as unknown as number} floatingRange={[-0.5, 0.5]}>
              <group position={[canPositionX as unknown as number, canPositionY as unknown as number, 0]} scale={isMobile ? 0.30 : (canScale as unknown as number)}>
                <animated.group
                  rotation-x={SPIN_AXIS === 'x' ? spinY : 0}
                  rotation-y={SPIN_AXIS === 'y' ? spinY : 0}
                  rotation-z={SPIN_AXIS === 'z' ? spinY : 0}
                >
                  <LiquidTexture prevSlide={prevSlide} currentSlide={currentSlide} progress={transitionProgress} slideCanvases={slideCanvases} setTexture={setTexture} />
                  <PresentationControls
                    key={spinCount}
                    global={false}
                    cursor={true}
                    snap={false}
                    speed={dragSpeed as unknown as number}
                    zoom={1}
                    polar={[0, 0]}
                  >
                    <group rotation={canRotation as [number, number, number]}>
                      <HydrationCan labelTexture={texture} isMobile={isMobile} />
                    </group>
                  </PresentationControls>
                </animated.group>
                {/* Water spiral is independent of slide spin transitions */}
                <WaterSpiral
                  spiralControls={waterSpiralSettings}
                  materialControls={{ ...waterMaterialSettings, waterColor: slide.waterColor || waterMaterialSettings.waterColor }}
                  globalBg={slide.bgColor || '#000000'}
                />
              </group>
            </Float>
          </Canvas>
        </div>

        {/* Navigation / CTA Group (bottom-center) */}
        <div className="bottom-nav-group">
          <button className="nav-arrow nav-arrow-left" onClick={() => goToSlide(-1)} aria-label="Previous">
            <svg viewBox="0 0 25 24" xmlns="http://www.w3.org/2000/svg"><path d="M15.5 19l-7-7 7-7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
          </button>

          <a href="https://next-hydration.netlify.app/liquidity?type=all&myLiquidity=false&omniSort=%5B%7B%22id%22:%22id%22,%22desc%22:true%7D%5D&isolatedSort=%5B%7B%22id%22:%22tvlDisplay%22,%22desc%22:true%7D%5D" className="cta-button" target="_blank" rel="noopener noreferrer">
            {(slide.footer || '').replace(/\n/g, ' ')}
          </a>

          <button className="nav-arrow nav-arrow-right" onClick={() => goToSlide(1)} aria-label="Next">
            <svg viewBox="0 0 25 24" xmlns="http://www.w3.org/2000/svg"><path d="M9.5 5l7 7-7 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
          </button>
        </div>

        {/* Navigation Hint (below the group) */}
        <div className="nav-hint">
          use <svg width="34" height="16" viewBox="0 0 34 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ verticalAlign: 'middle', marginRight: '8px', opacity: 0.8 }}>
            <rect x="0.75" y="0.75" width="14.5" height="14.5" rx="3.25" stroke="white" strokeWidth="1.5" />
            <path d="M10 8H6M6 8L8 6M6 8L8 10" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="18.75" y="0.75" width="14.5" height="14.5" rx="3.25" stroke="white" strokeWidth="1.5" />
            <path d="M24 8H28M28 8L26 6M28 8L26 10" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          to navigate
        </div>

        {/* Slide indicator dots */}
        <div className="slide-dots">
          {SLIDES.map((_, i) => (
            <span key={i} className={`dot ${i === currentSlide ? 'active' : ''}`} />
          ))}
        </div>
      </div>
    </div>
  )
}

export default Scene
