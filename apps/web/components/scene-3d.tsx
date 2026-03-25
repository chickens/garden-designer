"use client"

import * as React from "react"
import { useProject } from "@/lib/project-store"
import { useTheme } from "next-themes"

export function Scene3D() {
  const { project } = useProject()
  const { resolvedTheme } = useTheme()
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const engineRef = React.useRef<any>(null)

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !project) return

    let disposed = false

    async function init() {
      const BABYLON = await import("babylonjs")
      if (disposed) return

      // Clean up previous engine
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
      scene.clearColor = isDark
        ? new BABYLON.Color4(0.04, 0.04, 0.04, 1)
        : new BABYLON.Color4(0.96, 0.96, 0.96, 1)

      // Camera
      const camera = new BABYLON.ArcRotateCamera(
        "camera",
        -Math.PI / 4,
        Math.PI / 3,
        Math.max(wMeters, dMeters) * 1.5,
        new BABYLON.Vector3(wMeters / 2, 0, dMeters / 2),
        scene
      )
      camera.lowerRadiusLimit = 1
      camera.upperRadiusLimit = Math.max(wMeters, dMeters) * 5
      camera.lowerBetaLimit = 0.1
      camera.upperBetaLimit = Math.PI / 2 - 0.05
      camera.attachControl(canvas, true)

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

      // DynamicTexture grid
      const texSize = 2048
      const dt = new BABYLON.DynamicTexture("gridTex", texSize, scene, true)
      const dtCtx = dt.getContext()

      // Fill with garden color
      dtCtx.fillStyle = isDark ? "#1a1f14" : "#f0f5e8"
      dtCtx.fillRect(0, 0, texSize, texSize)

      // Draw grid on texture
      const pxPerMeterW = texSize / wMeters
      const pxPerMeterD = texSize / dMeters

      // Minor grid (every 5cm = 0.05m)
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

      // Major grid (every 1m)
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

      // Border: 4 thin boxes
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

      // Front & back (along X)
      createBorder(
        "borderFront",
        wMeters,
        borderHeight,
        borderThick,
        wMeters / 2, borderHeight / 2, 0
      )
      createBorder(
        "borderBack",
        wMeters,
        borderHeight,
        borderThick,
        wMeters / 2, borderHeight / 2, dMeters
      )
      // Left & right (along Z)
      createBorder(
        "borderLeft",
        borderThick,
        borderHeight,
        dMeters,
        0, borderHeight / 2, dMeters / 2
      )
      createBorder(
        "borderRight",
        borderThick,
        borderHeight,
        dMeters,
        wMeters, borderHeight / 2, dMeters / 2
      )

      engine.runRenderLoop(() => {
        if (!disposed) scene.render()
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
    }
  }, [project, resolvedTheme])

  return (
    <canvas
      ref={canvasRef}
      className="h-full w-full outline-none"
      onContextMenu={(e) => e.preventDefault()}
    />
  )
}
