import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MarchingCubes, MeshTransmissionMaterial } from '@react-three/drei'
import * as THREE from 'three'

interface WaterSpiralProps {
    spiralControls: any
    materialControls: any
    globalBg: string
}

export function WaterSpiral({ spiralControls, materialControls, globalBg }: WaterSpiralProps) {
    const {
        waterVisible: visible,
        waterNumDroplets: numDroplets,
        waterRadius: radius,
        waterHeight: height,
        waterSpeed: speed,
        waterMarchingScale: marchingScale,
        waterResolution: resolution,
        waterIsolation: isolation,
        waterBlobStrength: blobStrength,
        waterBlobSubtract: blobSubtract,
        waterNoiseScale: noiseScale,
        waterRotationSpeed: rotationSpeed,
        waterSpiralTwists: spiralTwists,
        waterPositionX: positionX,
        waterPositionY: positionY,
        waterPositionZ: positionZ,
        waterDistortionStrength: distortionStrength,
        waterDistortionArea: distortionArea,
    } = spiralControls

    const {
        waterColor,
        waterTransmission: transmission,
        waterRoughness: roughness,
        waterMetalness: metalness,
        waterThickness: thickness,
        waterIor: ior,
        waterEnvMapIntensity: envMapIntensity,
        waterClearcoat: clearcoat,
        waterClearcoatRoughness: clearcoatRoughness,
        waterSpecularIntensity: specularIntensity,
        waterSpecularColor: specularColor,
        waterAttenuationColor: attenuationColor,
        waterAttenuationDistance: attenuationDistance,
        waterOpacity: opacity,
        waterTransparent: transparent,
        waterBlending: blending,
        waterDepthWrite: depthWrite,
    } = materialControls

    const groupRef = useRef<THREE.Group>(null)
    const marchingCubesRef = useRef<any>(null)

    // Store independent physics state (offsets + velocities) for every droplet
    // We assume max 500 droplets to avoid resizing the array constantly
    const physicsRef = useRef<Array<{ dx: number, dy: number, dz: number, vx: number, vy: number, vz: number }>>(
        Array.from({ length: 500 }, () => ({ dx: 0, dy: 0, dz: 0, vx: 0, vy: 0, vz: 0 }))
    )

    // Track previous mouse position to calculate velocity
    const prevPointer = useRef(new THREE.Vector2())

    useFrame((state, delta) => {
        if (!visible) return
        const time = state.clock.getElapsedTime() * (speed as number)

        if (marchingCubesRef.current) {
            marchingCubesRef.current.isolation = isolation as number
        }

        if (!marchingCubesRef.current) return
        const mc = marchingCubesRef.current

        // Continuous rotation offset
        const rotationAngle = state.clock.getElapsedTime() * (rotationSpeed as number)

        const dropletCount = numDroplets as number
        const twistCount = spiralTwists as number
        const rad = radius as number
        const h = height as number
        const bStrength = blobStrength as number
        const bSubtract = blobSubtract as number
        const nScale = noiseScale as number
        const distArea = distortionArea as number
        const distStrength = distortionStrength as number

        // Mouse Velocity calculation (in NDC -1 to 1)
        const mouseVelocity = new THREE.Vector2().subVectors(state.pointer, prevPointer.current)
        const mouseSpeed = mouseVelocity.length() / delta

        // Convert mouse position to roughly match the 3D grid space (0 to 1)
        // Assume z is mostly in the middle
        const mouseGridX = (state.pointer.x + 1) / 2
        const mouseGridY = (state.pointer.y + 1) / 2

        for (let i = 0; i < dropletCount; i++) {
            const normalizedPos = i / dropletCount
            const t = (normalizedPos + (time * 0.1)) % 1.0

            // Base math
            const yOffset = (t - 0.5) * h
            const currentY = 0.5 + yOffset
            const angle = t * Math.PI * 2 * twistCount + rotationAngle
            const envelope = Math.sin(t * Math.PI)

            const xOffset = Math.cos(angle) * rad
            const zOffset = Math.sin(angle) * rad
            const wobbleX = Math.sin(time * 3 + i) * nScale
            const wobbleZ = Math.cos(time * 2.5 + i) * nScale

            let finalX = 0.5 + xOffset + wobbleX
            let finalZ = 0.5 + zOffset + wobbleZ

            // --- Interactive Physics ---
            const phys = physicsRef.current[i]

            // 1. Mouse Repulsion
            // Only interact if mouse is moving fast enough and we're hovering "near" it in X/Y plane
            if (mouseSpeed > 1.0) {
                const distToMouse = Math.hypot(finalX - mouseGridX, currentY - mouseGridY)
                if (distToMouse < distArea) { // Radius of influence from slider
                    // Push droplet in direction of mouse velocity times the strength slider
                    const pushFactor = (distArea - distToMouse) * distStrength * (mouseSpeed * 0.05)
                    phys.vx += mouseVelocity.x * pushFactor
                    phys.vy += mouseVelocity.y * pushFactor
                    // Add some chaotic Z dispersal
                    phys.vz += (Math.random() - 0.5) * pushFactor
                }
            }

            // 2. Spring force (pull back to origin)
            const springTension = 5.0
            const friction = 0.90

            phys.vx -= phys.dx * springTension * delta
            phys.vy -= phys.dy * springTension * delta
            phys.vz -= phys.dz * springTension * delta

            // 3. Apply velocity & friction
            phys.vx *= friction
            phys.vy *= friction
            phys.vz *= friction

            phys.dx += phys.vx * delta
            phys.dy += phys.vy * delta
            phys.dz += phys.vz * delta

            // Add physics displacement to final position
            finalX += phys.dx
            const finalY = currentY + phys.dy
            finalZ += phys.dz

            // --- Rendering ---
            let smoothEnvelope = envelope
            if (smoothEnvelope < 0.05) smoothEnvelope = 0
            const finalStrength = (bStrength * 0.15) + (smoothEnvelope * bStrength)

            if (finalStrength > 0.01) {
                const MARGIN = 1.4 // 40% more space
                const invMargin = 1 / MARGIN
                mc.addBall(
                    0.5 + (finalX - 0.5) * invMargin,
                    0.5 + (finalY - 0.5) * invMargin,
                    0.5 + (finalZ - 0.5) * invMargin,
                    finalStrength * invMargin,
                    bSubtract
                )
            }
        }

        prevPointer.current.copy(state.pointer)
    })

    if (!visible) return null

    const MARGIN = 1.4 // Match the loop margin
    const s = (marchingScale as number) * MARGIN

    return (
        <group ref={groupRef} position={[positionX as number, positionY as number, positionZ as number]}>
            <MarchingCubes
                ref={marchingCubesRef}
                resolution={resolution as number}
                maxPolyCount={40000}
                enableUvs={false}
                enableColors={false}
                scale={s}
                position={[-s / 2, -s / 2, -s / 2] as any}
            >
                <MeshTransmissionMaterial
                    color={waterColor as string}
                    transmission={transmission as number}
                    roughness={roughness as number}
                    metalness={metalness as number}
                    thickness={thickness as number}
                    ior={ior as number}
                    envMapIntensity={envMapIntensity as number}
                    clearcoat={clearcoat as number}
                    clearcoatRoughness={clearcoatRoughness as number}
                    specularIntensity={specularIntensity as number}
                    specularColor={specularColor as string}
                    attenuationColor={attenuationColor as string}
                    attenuationDistance={attenuationDistance as number}
                    opacity={opacity as number}
                    transparent={transparent as boolean}
                    blending={blending as any}
                    depthWrite={depthWrite as boolean}
                    background={new THREE.Color(globalBg.length === 9 ? globalBg.slice(0, 7) : globalBg)} // Needs background color to blend correctly
                    samples={8} // High quality blurring
                    resolution={512} // Refraction resolution
                    backside={true}
                    anisotropicBlur={0.1}
                />
            </MarchingCubes>
        </group>
    )
}
