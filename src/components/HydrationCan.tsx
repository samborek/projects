import * as THREE from 'three'
import React, { useMemo } from 'react'
import { useGraph } from '@react-three/fiber'
import { useGLTF, Center, useTexture } from '@react-three/drei'
import { useControls } from 'leva'
import type { GLTF } from 'three-stdlib'
import { SkeletonUtils, SimplexNoise } from 'three-stdlib'
import matcapUrl from '../assets/matcap/C09E5C_DAD2B9_654429_81582D.png'

type GLTFResult = GLTF & {
  nodes: {
    ['Can-LABEL_moonjuice']: THREE.Mesh
    ['Can-Metal_Screw_Silver']: THREE.Mesh
    Pull_Tab: THREE.Mesh
    Top: THREE.Mesh
    Rivet: THREE.Mesh
  }
  materials: {}
}

export function HydrationCan({ labelTexture, isMobile, ...props }: any) {
  const { scene } = useGLTF('/hydration_can.gltf')
  const clone = useMemo(() => SkeletonUtils.clone(scene), [scene])
  const { nodes } = useGraph(clone) as unknown as GLTFResult

  // Create a default gradient texture if no texture is provided
  const defaultTexture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 1024
    const context = canvas.getContext('2d')
    if (context) {
      const gradient = context.createLinearGradient(0, 0, 1024, 1024)
      gradient.addColorStop(0, '#ff00cc')
      gradient.addColorStop(0.5, '#333399')
      gradient.addColorStop(1, '#00ffff')
      context.fillStyle = gradient
      context.fillRect(0, 0, 1024, 1024)
    }
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.flipY = false
    return tex
  }, [])

  const savedSettingsStr = localStorage.getItem('hydration-can-material-settings')
  const savedSettings = savedSettingsStr ? JSON.parse(savedSettingsStr) : {}
  const getSaved = (key: string, defaultVal: any) => savedSettings[key] !== undefined ? savedSettings[key] : defaultVal

  const canMaterialProps = useControls('Can Material', {
    materialType: { options: ['Physical', 'Matcap'], value: getSaved('materialType', "Physical") },
    color: getSaved('color', "#111111") as string,
    metalness: { value: getSaved('metalness', 0.9) as number, min: 0, max: 1 },
    roughness: { value: getSaved('roughness', 0.3) as number, min: 0, max: 1 },
    clearcoat: { value: getSaved('clearcoat', 0.2) as number, min: 0, max: 1 },
    clearcoatRoughness: { value: getSaved('clearcoatRoughness', 0.2) as number, min: 0, max: 1 },
    transmission: { value: getSaved('transmission', 0) as number, min: 0, max: 1 },
    ior: { value: getSaved('ior', 1.5) as number, min: 1, max: 2.33 },
    thickness: { value: getSaved('thickness', 0) as number, min: 0, max: 5 },
    sheen: { value: getSaved('sheen', 0) as number, min: 0, max: 1 },
    sheenColor: getSaved('sheenColor', "#ffffff") as string
  })

  // Load the matcap texture
  const matcapTexture = useTexture(matcapUrl)

  const labelMaterialProps = useControls('Label Material', {
    roughness: { value: getSaved('labelRoughness', 0.2) as number, min: 0, max: 1 },
    metalness: { value: getSaved('labelMetalness', 0.18) as number, min: 0, max: 1 },
    condensation: { value: getSaved('condensation', 0.5) as number, min: 0, max: 2 },
  })

  const bumpProps = useControls('Condensation Bump Map', {
    amount: { value: getSaved('condAmount', 1500) as number, min: 0, max: 30000, step: 100 },
    size: { value: getSaved('condSize', 1) as number, min: 0.1, max: 10, step: 0.1 },
    streakChance: { value: getSaved('condStreakChance', 0) as number, min: 0, max: 0.5, step: 0.01 },
    streakLength: { value: getSaved('condStreakLength', 5) as number, min: 5, max: 150, step: 1 },
    gradientAngle: { value: getSaved('condGradientAngle', 109) as number, min: 0, max: 360, step: 1 },
    fadeStart: { value: getSaved('condFadeStart', 0.69) as number, min: 0, max: 1, step: 0.01 },
    fadeEnd: { value: getSaved('condFadeEnd', 0.31) as number, min: 0, max: 1, step: 0.01 },
    noiseType: { options: ['None', 'Simplex Soft', 'Simplex Sparse'], value: getSaved('condNoiseType', "Simplex Sparse") },
    noiseScale: { value: getSaved('condNoiseScale', 9.200000000000001) as number, min: 0.1, max: 20, step: 0.1 },
  })

  const dropletProps = useControls('3D Droplets', {
    amount: { value: getSaved('dropAmount', 2400) as number, min: 0, max: 30000, step: 100 },
    size: { value: getSaved('dropSize', 1) as number, min: 0.1, max: 10, step: 0.1 },
    dropHeight: { value: getSaved('condDropHeight', 0.4) as number, min: 0.05, max: 2, step: 0.05 },
    surfaceDistance: { value: getSaved('condSurfaceDistance', 0) as number, min: -0.01, max: 0.01, step: 0.0001 },
    streakChance: { value: getSaved('dropStreakChance', 0) as number, min: 0, max: 0.5, step: 0.01 },
    streakLength: { value: getSaved('dropStreakLength', 5) as number, min: 5, max: 150, step: 1 },
    gradientAngle: { value: getSaved('dropGradientAngle', 90) as number, min: 0, max: 360, step: 1 },
    fadeStart: { value: getSaved('dropFadeStart', 0.29) as number, min: 0, max: 1, step: 0.01 },
    fadeEnd: { value: getSaved('dropFadeEnd', 1) as number, min: 0, max: 1, step: 0.01 },
    noiseType: { options: ['None', 'Simplex Soft', 'Simplex Sparse'], value: getSaved('dropNoiseType', "Simplex Soft") },
    noiseScale: { value: getSaved('dropNoiseScale', 2) as number, min: 0.1, max: 20, step: 0.1 },
    roughness: { value: getSaved('condRoughness', 0.22000000000000006) as number, min: 0, max: 1, step: 0.01 },
    metalness: { value: getSaved('condMetalness', 0) as number, min: 0, max: 1, step: 0.01 },
    ior: { value: getSaved('condIor', 1.15) as number, min: 1, max: 2.33, step: 0.01 },
    transmission: { value: getSaved('condTransmission', 1) as number, min: 0, max: 1, step: 0.01 },
  })

  // Autosave materials
  React.useEffect(() => {
    localStorage.setItem('hydration-can-material-settings', JSON.stringify({
      ...canMaterialProps,
      labelRoughness: labelMaterialProps.roughness,
      labelMetalness: labelMaterialProps.metalness,
      condensation: labelMaterialProps.condensation,
      condAmount: bumpProps.amount,
      condSize: bumpProps.size,
      condStreakChance: bumpProps.streakChance,
      condStreakLength: bumpProps.streakLength,
      condGradientAngle: bumpProps.gradientAngle,
      condFadeStart: bumpProps.fadeStart,
      condFadeEnd: bumpProps.fadeEnd,
      condNoiseType: bumpProps.noiseType,
      condNoiseScale: bumpProps.noiseScale,
      dropAmount: dropletProps.amount,
      dropSize: dropletProps.size,
      condDropHeight: dropletProps.dropHeight,
      condSurfaceDistance: dropletProps.surfaceDistance,
      dropStreakChance: dropletProps.streakChance,
      dropStreakLength: dropletProps.streakLength,
      dropGradientAngle: dropletProps.gradientAngle,
      dropFadeStart: dropletProps.fadeStart,
      dropFadeEnd: dropletProps.fadeEnd,
      dropNoiseType: dropletProps.noiseType,
      dropNoiseScale: dropletProps.noiseScale,
      condRoughness: dropletProps.roughness,
      condMetalness: dropletProps.metalness,
      condIor: dropletProps.ior,
      condTransmission: dropletProps.transmission,
    }))
  }, [canMaterialProps, labelMaterialProps, bumpProps, dropletProps])
  // Procedural Condensation Droplets Bump Map
  const dropletsBumpMap = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 1024
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = '#000000' // black background (0 height)
      ctx.fillRect(0, 0, 1024, 1024)

      // Setup Gradient and Noise functions
      const { amount, size, streakChance, streakLength, gradientAngle, fadeStart, fadeEnd, noiseType, noiseScale } = bumpProps
      const angleRad = (gradientAngle * Math.PI) / 180
      const dirX = Math.cos(angleRad)
      const dirY = Math.sin(angleRad)
      const simplex = new SimplexNoise()

      // We draw more drops for the bump map than the mesh to get a fine misty base
      const actualAmount = isMobile ? amount * 0.5 : amount * 1.5
      for (let i = 0; i < actualAmount; i++) {
        const x = Math.random() * 1024
        const y = Math.random() * 1024

        // Project coordinate on rotated gradient vector
        const cx = x - 512
        const cy = y - 512
        const dot = cx * dirX + cy * dirY
        // Max distance in 1024x1024 from center is approx 724
        let normalizedDist = (dot + 724.07) / (724.07 * 2)
        normalizedDist = Math.max(0, Math.min(1, normalizedDist))

        let prob = 1

        if (fadeStart !== fadeEnd) {
          prob = (normalizedDist - fadeStart) / (fadeEnd - fadeStart)
          prob = Math.max(0, Math.min(1, prob))
        }

        // Apply selected noise distribution mapping
        if (noiseType !== 'None') {
          const nx = (x / 1024) * noiseScale
          const ny = (y / 1024) * noiseScale
          let n = simplex.noise(nx, ny)
          n = (n + 1) / 2 // bring to 0-1

          if (noiseType === 'Simplex Sparse') {
            n = Math.pow(n, 4) // Make the noise distribution aggressively clumpy
          }

          prob *= n
        }

        if (Math.random() > prob) continue

        const r = (Math.random() * 3 + 1) * size

        const grad = ctx.createRadialGradient(x, y, 0, x, y, r)
        grad.addColorStop(0, 'rgba(255, 255, 255, 1)')
        grad.addColorStop(1, 'rgba(0, 0, 0, 1)')

        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()

        // Occasional long run-down streaks
        if (Math.random() < streakChance) {
          const runLength = (Math.random() * streakLength + 10) * size
          const lineGrad = ctx.createLinearGradient(x, y, x, y + runLength)
          lineGrad.addColorStop(0, 'rgba(255, 255, 255, 0.8)')
          lineGrad.addColorStop(1, 'rgba(0, 0, 0, 1)')

          ctx.fillStyle = lineGrad
          ctx.fillRect(x - r / 2, y, r, runLength)
        }
      }
    }
    const tex = new THREE.CanvasTexture(canvas)
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    // repeat 5 horizontally, 1 vertically (to preserve Y gradient scale)
    tex.repeat.set(5, 1)
    tex.anisotropy = 8

    // We must ensure flipY is correct for the mesh UVs (same as the label)
    tex.flipY = false
    return tex
  }, [bumpProps.amount, bumpProps.size, bumpProps.streakChance, bumpProps.streakLength, bumpProps.gradientAngle, bumpProps.fadeStart, bumpProps.fadeEnd, bumpProps.noiseType, bumpProps.noiseScale])

  // Procedural 3D Condensation Droplets (InstancedMesh) — Surface sampling from actual mesh
  const dropletsMesh = useMemo(() => {
    const {
      amount, size, streakChance, streakLength,
      dropHeight, surfaceDistance, roughness, metalness, ior, transmission,
      gradientAngle, fadeStart, fadeEnd, noiseType, noiseScale
    } = dropletProps
    const angleRad = (gradientAngle * Math.PI) / 180
    const dirX = Math.cos(angleRad)
    const dirY = Math.sin(angleRad)
    const simplex = new SimplexNoise()

    // Use the actual label mesh geometry for surface sampling
    const geo = nodes['Can-LABEL_moonjuice'].geometry
    const posAttr = geo.attributes.position as THREE.BufferAttribute
    const normalAttr = geo.attributes.normal as THREE.BufferAttribute
    const indexAttr = geo.index

    if (!posAttr || !normalAttr) return null

    // Compute bounding box for gradient mapping and radius reference
    geo.computeBoundingBox()
    const bbox = geo.boundingBox!
    const canHeight = bbox.max.y - bbox.min.y
    const canRadiusX = (bbox.max.x - bbox.min.x) / 2
    const canRadiusZ = (bbox.max.z - bbox.min.z) / 2
    const canRadius = Math.max(canRadiusX, canRadiusZ)

    // Build triangle list
    const triCount = indexAttr ? indexAttr.count / 3 : posAttr.count / 3
    const getIndex = (i: number) => indexAttr ? indexAttr.getX(i) : i

    // Pre-compute triangle areas for area-weighted random selection
    const areas: number[] = []
    let totalArea = 0
    const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3()
    const edge1 = new THREE.Vector3(), edge2 = new THREE.Vector3()

    for (let t = 0; t < triCount; t++) {
      const i0 = getIndex(t * 3)
      const i1 = getIndex(t * 3 + 1)
      const i2 = getIndex(t * 3 + 2)
      vA.fromBufferAttribute(posAttr, i0)
      vB.fromBufferAttribute(posAttr, i1)
      vC.fromBufferAttribute(posAttr, i2)
      edge1.subVectors(vB, vA)
      edge2.subVectors(vC, vA)
      const area = edge1.cross(edge2).length() * 0.5
      areas.push(area)
      totalArea += area
    }

    // Build cumulative distribution for weighted random triangle selection
    const cdf: number[] = []
    let cumulative = 0
    for (let t = 0; t < triCount; t++) {
      cumulative += areas[t] / totalArea
      cdf.push(cumulative)
    }

    const dummy = new THREE.Object3D()
    const matrices: THREE.Matrix4[] = []
    const nA = new THREE.Vector3(), nB = new THREE.Vector3(), nC = new THREE.Vector3()
    const sampledPos = new THREE.Vector3(), sampledNormal = new THREE.Vector3()

    const actualAmount = isMobile ? Math.min(amount, 800) : amount

    for (let i = 0; i < actualAmount; i++) {
      // Pick a random triangle weighted by area
      const r = Math.random()
      let triIdx = 0
      for (let t = 0; t < triCount; t++) {
        if (r <= cdf[t]) { triIdx = t; break }
      }

      const i0 = getIndex(triIdx * 3)
      const i1 = getIndex(triIdx * 3 + 1)
      const i2 = getIndex(triIdx * 3 + 2)

      // Get triangle vertices
      vA.fromBufferAttribute(posAttr, i0)
      vB.fromBufferAttribute(posAttr, i1)
      vC.fromBufferAttribute(posAttr, i2)

      // Random barycentric coordinates
      let u = Math.random(), v = Math.random()
      if (u + v > 1) { u = 1 - u; v = 1 - v }
      const w = 1 - u - v

      // Interpolate position
      sampledPos.set(
        vA.x * w + vB.x * u + vC.x * v,
        vA.y * w + vB.y * u + vC.y * v,
        vA.z * w + vB.z * u + vC.z * v
      )

      // Interpolate normal
      nA.fromBufferAttribute(normalAttr, i0)
      nB.fromBufferAttribute(normalAttr, i1)
      nC.fromBufferAttribute(normalAttr, i2)
      sampledNormal.set(
        nA.x * w + nB.x * u + nC.x * v,
        nA.y * w + nB.y * u + nC.y * v,
        nA.z * w + nB.z * u + nC.z * v
      ).normalize()

      // Gradient distribution mask (use UV-like coords for the gradient)
      const theta = Math.atan2(sampledPos.z - (bbox.max.z + bbox.min.z) / 2, sampledPos.x - (bbox.max.x + bbox.min.x) / 2)
      const nxCoord = (theta + Math.PI) / (Math.PI * 2) // 0-1 around circumference
      const nyCoord = (sampledPos.y - bbox.min.y) / canHeight // 0-1 along height

      const cx = nxCoord - 0.5
      const cy = nyCoord - 0.5
      const dot = cx * dirX + cy * dirY
      let normalizedDist = (dot + 0.707) / 1.414
      normalizedDist = Math.max(0, Math.min(1, normalizedDist))

      let prob = 1
      if (fadeStart !== fadeEnd) {
        prob = (normalizedDist - fadeStart) / (fadeEnd - fadeStart)
        prob = Math.max(0, Math.min(1, prob))
      }

      if (noiseType !== 'None') {
        let n = simplex.noise(nxCoord * noiseScale, nyCoord * noiseScale)
        n = (n + 1) / 2
        if (noiseType === 'Simplex Sparse') n = Math.pow(n, 4)
        prob *= n
      }

      if (Math.random() > prob) continue

      // Random radius per drop, relative to canRadius
      const dropRadius = ((Math.random() * 0.03) + 0.01) * canRadius * size

      // Position at the sampled surface point, offset along normal
      dummy.position.copy(sampledPos)
      dummy.position.addScaledVector(sampledNormal, surfaceDistance)

      // Orient the droplet flat against the actual surface normal
      const lookTarget = new THREE.Vector3().copy(sampledPos).addScaledVector(sampledNormal, 1)
      dummy.lookAt(lookTarget)

      // Elongate some drops if streaks are requested
      let scaleY = 1
      if (Math.random() < streakChance) {
        scaleY = (Math.random() * streakLength * 0.1) + 1
      }

      // Scale: X and Y spread on surface, Z is height sticking out
      dummy.scale.set(dropRadius, dropRadius * scaleY, dropRadius * dropHeight)

      dummy.updateMatrix()
      matrices.push(dummy.matrix.clone())
    }

    console.log(`[Droplets] Generated ${matrices.length} spheres on mesh surface (${triCount} triangles, totalArea=${totalArea.toFixed(8)})`)

    if (matrices.length === 0) return null

    // Generate InstancedMesh with user-controllable material
    const geometry = new THREE.SphereGeometry(1, 16, 16)
    const material = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transmission: transmission,
      opacity: 1,
      transparent: true,
      metalness: metalness,
      roughness: roughness,
      ior: ior,
      thickness: 0.2,
      clearcoat: 1,
      clearcoatRoughness: 0
    })

    const instancedMesh = new THREE.InstancedMesh(geometry, material, matrices.length)
    for (let i = 0; i < matrices.length; i++) {
      instancedMesh.setMatrixAt(i, matrices[i])
    }
    instancedMesh.instanceMatrix.needsUpdate = true

    return <primitive object={instancedMesh} />
  }, [dropletProps.amount, dropletProps.size, dropletProps.streakChance, dropletProps.streakLength, dropletProps.dropHeight, dropletProps.surfaceDistance, dropletProps.roughness, dropletProps.metalness, dropletProps.ior, dropletProps.transmission, dropletProps.gradientAngle, dropletProps.fadeStart, dropletProps.fadeEnd, dropletProps.noiseType, dropletProps.noiseScale])

  // Make the texture flip correctly if an image is uploaded
  if (labelTexture) {
    labelTexture.flipY = false
  }

  return (
    <group {...props} dispose={null}>
      {/* Rescale and center based on the original gltf matrix */}
      <group scale={0.005}>
        <Center precise>
          {/* We strip out the generated camera and lights, only keep the geometry */}
          <group position={[-221.437, 197.343, 285.122]} rotation={[1.374, 0.168, 0.479]} scale={21884.889}>
            <group position={[0, -0.062, 0]}>
              <mesh geometry={nodes.Pull_Tab.geometry} position={[0, 0.124, 0]}>
                {canMaterialProps.materialType === 'Matcap' ? (
                  <meshMatcapMaterial matcap={matcapTexture} color={canMaterialProps.color} />
                ) : (
                  <meshPhysicalMaterial {...canMaterialProps} bumpMap={canMaterialProps.metalness > 0.5 ? dropletsBumpMap : undefined} bumpScale={labelMaterialProps.condensation * 15} />
                )}
              </mesh>
              <mesh geometry={nodes.Top.geometry} position={[0, 0.121, 0]}>
                {canMaterialProps.materialType === 'Matcap' ? (
                  <meshMatcapMaterial matcap={matcapTexture} color={canMaterialProps.color} />
                ) : (
                  <meshPhysicalMaterial {...canMaterialProps} bumpMap={canMaterialProps.metalness > 0.5 ? dropletsBumpMap : undefined} bumpScale={labelMaterialProps.condensation * 15} />
                )}
              </mesh>
              <mesh geometry={nodes.Rivet.geometry} position={[0, 0.124, 0]}>
                {canMaterialProps.materialType === 'Matcap' ? (
                  <meshMatcapMaterial matcap={matcapTexture} color={canMaterialProps.color} />
                ) : (
                  <meshPhysicalMaterial {...canMaterialProps} bumpMap={canMaterialProps.metalness > 0.5 ? dropletsBumpMap : undefined} bumpScale={labelMaterialProps.condensation * 15} />
                )}
              </mesh>
              <mesh geometry={nodes['Can-LABEL_moonjuice'].geometry}>
                <meshStandardMaterial
                  map={labelTexture || defaultTexture}
                  roughness={labelMaterialProps.roughness}
                  metalness={labelMaterialProps.metalness}
                  bumpMap={labelMaterialProps.condensation > 0 ? dropletsBumpMap : undefined}
                  bumpScale={labelMaterialProps.condensation * 25}
                />
              </mesh>
              <mesh geometry={nodes['Can-Metal_Screw_Silver'].geometry}>
                {canMaterialProps.materialType === 'Matcap' ? (
                  <meshMatcapMaterial matcap={matcapTexture} color={canMaterialProps.color} />
                ) : (
                  <meshPhysicalMaterial {...canMaterialProps} bumpMap={canMaterialProps.metalness > 0.5 ? dropletsBumpMap : undefined} bumpScale={labelMaterialProps.condensation * 15} />
                )}
              </mesh>
              {labelMaterialProps.condensation > 0 && dropletsMesh}
            </group>
          </group>
        </Center>
      </group>
    </group>
  )
}

useGLTF.preload('/hydration_can.gltf')
