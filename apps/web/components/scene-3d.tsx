"use client"

import * as React from "react"
import { useProject } from "@/lib/project-store"
import { useTheme } from "next-themes"
import type { PlantDefinition, PlantPlacement, PlantingData } from "@/lib/types"
import { getCachedTextureUrl } from "@/lib/plant-textures"

export function Scene3D() {
  const { project, getPlantTexture, loadPlantTexture, setCamera3d } = useProject()
  const { resolvedTheme } = useTheme()
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const engineRef = React.useRef<any>(null)
  const sceneRef = React.useRef<any>(null)
  const plantMeshesRef = React.useRef<Map<string, any>>(new Map())

  const plantingData = project?.phases?.planting as PlantingData | undefined
  const placements = plantingData?.placements ?? []
  const plantDefs = plantingData?.plantDefinitions ?? {}

  const placementsKey = JSON.stringify(
    placements.map((p) => `${p.id}:${p.plantId}:${p.x}:${p.y}`)
  )

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !project) return

    let disposed = false

    async function init() {
      const BABYLON = await import("babylonjs")
      if (disposed) return

      if (engineRef.current) {
        engineRef.current.dispose()
      }

      const isDark = resolvedTheme === "dark"
      const { width: gardenW, depth: gardenD } = project!.dimensions
      const wMeters = gardenW / 100
      const dMeters = gardenD / 100

      const engine = new BABYLON.Engine(canvas, true, {
        adaptToDeviceRatio: true,
      })
      engineRef.current = engine

      const scene = new BABYLON.Scene(engine)
      sceneRef.current = scene
      scene.clearColor = isDark
        ? new BABYLON.Color4(0.04, 0.04, 0.04, 1)
        : new BABYLON.Color4(0.96, 0.96, 0.96, 1)

      // Camera — restore saved position or use default
      const saved3d = project!.camera3d
      const camera = new BABYLON.ArcRotateCamera(
        "camera",
        saved3d?.alpha ?? -Math.PI / 4,
        saved3d?.beta ?? Math.PI / 3,
        saved3d?.radius ?? Math.max(wMeters, dMeters) * 1.5,
        new BABYLON.Vector3(
          saved3d?.targetX ?? wMeters / 2,
          saved3d?.targetY ?? 0,
          saved3d?.targetZ ?? dMeters / 2
        ),
        scene
      )
      camera.lowerRadiusLimit = 1
      camera.upperRadiusLimit = Math.max(wMeters, dMeters) * 5
      camera.lowerBetaLimit = 0.1
      camera.upperBetaLimit = Math.PI / 2 - 0.05
      camera.attachControl(canvas, true)

      // Save camera state on change
      camera.onViewMatrixChangedObservable.add(() => {
        if (disposed) return
        setCamera3d({
          alpha: camera.alpha,
          beta: camera.beta,
          radius: camera.radius,
          targetX: camera.target.x,
          targetY: camera.target.y,
          targetZ: camera.target.z,
        })
      })

      // Lights
      const hemi = new BABYLON.HemisphericLight(
        "hemi",
        new BABYLON.Vector3(0, 1, 0),
        scene
      )
      hemi.intensity = isDark ? 0.6 : 0.8

      const dir = new BABYLON.DirectionalLight(
        "dir",
        new BABYLON.Vector3(-0.5, -1, -0.3),
        scene
      )
      dir.intensity = isDark ? 0.4 : 0.6

      // Ground plane with grid texture
      const ground = BABYLON.MeshBuilder.CreateGround(
        "ground",
        { width: wMeters, height: dMeters },
        scene
      )
      ground.position = new BABYLON.Vector3(wMeters / 2, 0, dMeters / 2)

      const texSize = 2048
      const dt = new BABYLON.DynamicTexture("gridTex", texSize, scene, true)
      const dtCtx = dt.getContext()

      dtCtx.fillStyle = isDark ? "#1a1f14" : "#f0f5e8"
      dtCtx.fillRect(0, 0, texSize, texSize)

      const pxPerMeterW = texSize / wMeters
      const pxPerMeterD = texSize / dMeters

      dtCtx.strokeStyle = isDark
        ? "rgba(255,255,255,0.06)"
        : "rgba(0,0,0,0.06)"
      dtCtx.lineWidth = 0.5
      for (let x = 0; x <= wMeters; x += 0.05) {
        const px = x * pxPerMeterW
        dtCtx.beginPath()
        dtCtx.moveTo(px, 0)
        dtCtx.lineTo(px, texSize)
        dtCtx.stroke()
      }
      for (let y = 0; y <= dMeters; y += 0.05) {
        const py = y * pxPerMeterD
        dtCtx.beginPath()
        dtCtx.moveTo(0, py)
        dtCtx.lineTo(texSize, py)
        dtCtx.stroke()
      }

      dtCtx.strokeStyle = isDark
        ? "rgba(255,255,255,0.2)"
        : "rgba(0,0,0,0.2)"
      dtCtx.lineWidth = 2
      for (let x = 0; x <= wMeters; x += 1) {
        const px = x * pxPerMeterW
        dtCtx.beginPath()
        dtCtx.moveTo(px, 0)
        dtCtx.lineTo(px, texSize)
        dtCtx.stroke()
      }
      for (let y = 0; y <= dMeters; y += 1) {
        const py = y * pxPerMeterD
        dtCtx.beginPath()
        dtCtx.moveTo(0, py)
        dtCtx.lineTo(texSize, py)
        dtCtx.stroke()
      }

      dt.update()

      const groundMat = new BABYLON.StandardMaterial("groundMat", scene)
      groundMat.diffuseTexture = dt
      groundMat.specularColor = new BABYLON.Color3(0, 0, 0)
      ground.material = groundMat

      // Border boxes
      const borderHeight = 0.1
      const borderThick = 0.04
      const borderColor = isDark
        ? new BABYLON.Color3(0.6, 0.6, 0.6)
        : new BABYLON.Color3(0.3, 0.3, 0.3)

      function createBorder(
        name: string,
        w: number,
        h: number,
        d: number,
        px: number,
        py: number,
        pz: number
      ) {
        const box = BABYLON.MeshBuilder.CreateBox(
          name,
          { width: w, height: h, depth: d },
          scene
        )
        box.position.set(px, py, pz)
        const mat = new BABYLON.StandardMaterial(name + "Mat", scene)
        mat.diffuseColor = borderColor
        mat.specularColor = new BABYLON.Color3(0, 0, 0)
        box.material = mat
      }

      createBorder("borderFront", wMeters, borderHeight, borderThick, wMeters / 2, borderHeight / 2, 0)
      createBorder("borderBack", wMeters, borderHeight, borderThick, wMeters / 2, borderHeight / 2, dMeters)
      createBorder("borderLeft", borderThick, borderHeight, dMeters, 0, borderHeight / 2, dMeters / 2)
      createBorder("borderRight", borderThick, borderHeight, dMeters, wMeters, borderHeight / 2, dMeters / 2)

      // --- Plant billboards ---
      const newMeshes = new Map<string, any>()

      for (const placement of placements) {
        const def = plantDefs[placement.plantId] as PlantDefinition | undefined
        if (!def) continue

        const heightM = ((def.height.max + def.height.min) / 2) / 100
        const spreadM = ((def.spread.max + def.spread.min) / 2) / 100
        const quadW = Math.max(spreadM, heightM * 0.6)
        const quadH = heightM

        const posX = placement.x / 100
        const posZ = placement.y / 100

        const plane = BABYLON.MeshBuilder.CreatePlane(
          `plant_${placement.id}`,
          { width: quadW, height: quadH, sideOrientation: BABYLON.Mesh.DOUBLESIDE },
          scene
        )
        plane.position = new BABYLON.Vector3(posX, quadH / 2, posZ)

        const mat = new BABYLON.StandardMaterial(`plantMat_${placement.id}`, scene)
        mat.specularColor = new BABYLON.Color3(0, 0, 0)
        mat.backFaceCulling = false

        // Check for cached texture URL (from a previous 3D view)
        const cachedUrl = getCachedTextureUrl(def.id)
        if (cachedUrl) {
          applyTexture(BABYLON, scene, mat, cachedUrl)
        } else {
          // Placeholder color
          const hex = def.color
          const r = parseInt(hex.slice(1, 3), 16) / 255
          const g = parseInt(hex.slice(3, 5), 16) / 255
          const b = parseInt(hex.slice(5, 7), 16) / 255
          mat.diffuseColor = new BABYLON.Color3(r, g, b)
          mat.alpha = 0.7

          // Try loading from project directory first, then generate
          loadPlantTexture(def.id).then((url) => {
            if (disposed) return
            if (url) {
              applyTexture(BABYLON, scene, mat, url)
              return
            }
            // No saved texture — generate one
            getPlantTexture(def.id, def.commonName, def.botanicalName, def.notes).then(
              (genUrl) => {
                if (disposed || !genUrl) return
                applyTexture(BABYLON, scene, mat, genUrl)
              }
            )
          })
        }

        plane.material = mat
        newMeshes.set(placement.id, plane)
      }

      plantMeshesRef.current = newMeshes

      // Render loop with Y-axis billboard
      engine.runRenderLoop(() => {
        if (disposed) return

        for (const [, mesh] of plantMeshesRef.current) {
          if (!mesh || mesh.isDisposed()) continue
          const camPos = camera.position
          const meshPos = mesh.position
          mesh.rotation.y = Math.atan2(
            camPos.x - meshPos.x,
            camPos.z - meshPos.z
          )
        }

        scene.render()
      })

      const onResize = () => engine.resize()
      window.addEventListener("resize", onResize)

      return () => {
        window.removeEventListener("resize", onResize)
      }
    }

    init()

    return () => {
      disposed = true
      if (engineRef.current) {
        engineRef.current.dispose()
        engineRef.current = null
      }
      sceneRef.current = null
      plantMeshesRef.current.clear()
    }
  }, [project, resolvedTheme, placementsKey]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <canvas
      ref={canvasRef}
      className="h-full w-full outline-none"
      onContextMenu={(e) => e.preventDefault()}
    />
  )
}

function applyTexture(
  BABYLON: any,
  scene: any,
  mat: any,
  url: string
) {
  try {
    const tex = new BABYLON.Texture(url, scene, false, true)
    tex.hasAlpha = true
    mat.diffuseTexture = tex
    mat.useAlphaFromDiffuseTexture = true
    mat.alphaMode = BABYLON.Engine.ALPHA_COMBINE
    mat.diffuseColor = new BABYLON.Color3(1, 1, 1)
    mat.alpha = 1
  } catch {
    // Scene may have been disposed
  }
}
