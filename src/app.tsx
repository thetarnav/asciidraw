import * as React from 'react'
import * as Tldraw from 'tldraw'

import {
    Vec, VecLike,
    Mat, MatLike,
} from 'tldraw'


const TAU = 6.283185307179586

/**
 * Mutating version of `Tldraw.Mat.applyToPoint`
 */
function transform(vec: VecLike, matrix: MatLike): void {
    let {x, y} = vec
    vec.x = x * matrix.a + y * matrix.c + matrix.e
    vec.y = x * matrix.b + y * matrix.d + matrix.f
}

function ccw_xy(Ax: number, Ay: number, Bx: number, By: number, Cx: number, Cy: number) {
    return (Cy-Ay) * (Bx-Ax) > (By-Ay) * (Cx-Ax)
}

function ccw_segments_intersecting_xy(
    Ax: number, Ay: number,
    Bx: number, By: number,
    Cx: number, Cy: number,
    Dx: number, Dy: number,
) {
    return ccw_xy(Ax, Ay, Cx, Cy, Dx, Dy) !== ccw_xy(Bx, By, Cx, Cy, Dx, Dy) && 
           ccw_xy(Ax, Ay, Bx, By, Cx, Cy) !== ccw_xy(Ax, Ay, Bx, By, Dx, Dy)
}

type Union<T> = {[K in keyof T]: UnionMember<T, K>}[keyof T]

type UnionMember<T, K extends keyof T> = {kind: K, data: T[K]}

type Shapes = {
    draw:      Tldraw.TLDrawShape
    arrow:     Tldraw.TLArrowShape
    geo:       Tldraw.TLGeoShape
    frame:     Tldraw.TLFrameShape
    embed:     Tldraw.TLEmbedShape
    group:     Tldraw.TLGroupShape    
    highlight: Tldraw.TLHighlightShape
    image:     Tldraw.TLImageShape
    line:      Tldraw.TLLineShape
    note:      Tldraw.TLNoteShape
    video:     Tldraw.TLVideoShape
}

type Shape = Union<Shapes>

function getShape(shape: Tldraw.TLShape): Shape {
    return {kind: shape.type, data: shape} as any
}

function CustomBackground(): React.ReactNode {

	const editor = Tldraw.useEditor()
	const rCanvas = React.useRef<HTMLCanvasElement>(null)

	React.useLayoutEffect(() => {

		const canvas = rCanvas.current
		if (!canvas) return

		canvas.style.width  = '100%'
		canvas.style.height = '100%'

		const ctx = canvas.getContext('2d')!
        ctx.imageSmoothingEnabled = false
        

        let dpr = 1
        let font_size = new Vec(16, 12)
        let window_size = new Vec()

		let raf = 0

        let measure_time = 0
        let resized = true

        const onResize = () => {resized = true}


        let _vec = new Vec // reuse object

        function drawGeometry(
            vertices: VecLike[],
            camera:   MatLike,
            mat:      MatLike,
            close:    boolean,
        ) {
            if (vertices.length > 1) {
                _vec.setTo(vertices[0])
                transform(_vec, mat)
                transform(_vec, camera)
                ctx.moveTo(_vec.x, _vec.y)
                for (let i = 1; i < vertices.length; i++) {
                    _vec.setTo(vertices[i])
                    transform(_vec, mat)
                    transform(_vec, camera)
                    ctx.lineTo(_vec.x, _vec.y)
                }
                if (close) {
                    _vec.setTo(vertices[0])
                    transform(_vec, mat)
                    transform(_vec, camera)
                    ctx.lineTo(_vec.x, _vec.y)
                }
            }
        }

		const render = (time: number) => {

            let needs_remeasure = time-measure_time > 4000 || resized

            if (needs_remeasure) {
                measure_time = time
                resized = false
                
                dpr = Tldraw.clamp(window.devicePixelRatio, 1, 2)

                window_size.x = window.innerWidth
                window_size.y = window.innerHeight

                canvas.width  = (window_size.x * dpr)|0
                canvas.height = (window_size.y * dpr)|0
            }
            
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
			ctx.clearRect(0, 0, window_size.x, window_size.y)
            
            if (needs_remeasure) {
                font_size.y = parseFloat(window.getComputedStyle(document.body).fontSize)
                ctx.font = font_size.y+'px monospace'
                font_size.x = ctx.measureText('M').width
            }

            let page_rect = editor.getViewportPageBounds()
            let camera = editor.getCamera()

            let cell_size = new Vec(font_size.x*camera.z, font_size.y*camera.z)

            let rows = Math.ceil(page_rect.h/font_size.y) + 1
            let cols = Math.ceil(page_rect.w/font_size.x) + 1

            let grid_pos_y = (-font_size.y -(page_rect.y%font_size.y)) * camera.z
            let grid_pos_x = (-font_size.x -(page_rect.x%font_size.x)) * camera.z

            /*
             render grid lines
            */
            let line_width = Math.min(2, camera.z/1.8 - 0.3)
            if (line_width > 0.1) {

                ctx.beginPath()
                ctx.strokeStyle = 'rgba(128, 128, 128, 0.2)'
                ctx.lineWidth = line_width
                
    
                // vertical lines
                for (let i = 0; i <= cols; i++) {
                    ctx.moveTo(grid_pos_x + i*cell_size.x, 0)
                    ctx.lineTo(grid_pos_x + i*cell_size.x, cell_size.y*rows)
                }
    
                // horizontal lines
                for (let i = 0; i <= rows; i++) {
                    ctx.moveTo(0,                grid_pos_y + i*cell_size.y)
                    ctx.lineTo(cell_size.x*cols, grid_pos_y + i*cell_size.y)
                }
    
                ctx.stroke()
            }

            // type Cell = {
            //     char:  string
            //     shape: Tldraw.TLShapeId
            // }

            let matrix: (undefined | null | string)[] = new Array(rows*cols)

            // draw rows and cols count in bottom right corner
            ctx.font = '16px monospace'
            ctx.fillStyle = 'rgba(128, 128, 128, 0.6)'
            let text = `${rows}×${cols}`
            let metrics = ctx.measureText(text)
            ctx.fillText(text, window_size.x - metrics.width - 100, window_size.y - 100)

            let camera_mat = new Mat(
                camera.z, 0, 0,
                camera.z, camera.x*camera.z, camera.y*camera.z,
            )

			let shapes = editor.getRenderingShapes()
			let theme = Tldraw.getDefaultColorTheme({isDarkMode: editor.user.getIsDarkMode()})


			for (let rendering_shape of shapes) {
                let shape = getShape(rendering_shape.shape)

                switch (shape.kind) {
                case 'draw': {

                    ctx.beginPath()
                    ctx.globalAlpha = rendering_shape.opacity

                    let geometry = editor.getShapeGeometry(shape.data)
                    let mat = editor.getShapePageTransform(rendering_shape.id)

                    if (geometry.vertices.length <= 1) {
                        console.log('single vertex')
                        break
                    }

                    // ctx.strokeStyle = theme[shape.data.props.color].solid
                    // ctx.lineWidth = 4
                    // ctx.stroke()
                    // if (shape.data.props.fill !== 'none' && shape.data.props.isClosed) {
                    //     ctx.fillStyle = theme[shape.data.props.color].semi
                    //     ctx.fill()
                    // }

                    let v         = new Vec
                    let cell      = new Vec
                    let prev_v    = new Vec
                    let prev_cell = new Vec

                    for (let vi = 0; vi < geometry.vertices.length; vi++) {
                        
                        prev_v.setTo(v)
                        prev_cell.setTo(cell)

                        v.setTo(geometry.vertices[vi])
                        transform(v, mat)
                        transform(v, camera_mat)

                        cell.x = Math.floor((v.x-grid_pos_x) / cell_size.x)
                        cell.y = Math.floor((v.y-grid_pos_y) / cell_size.y)

                        if (cell.equals(prev_cell)) {
                            v.setTo(prev_v)
                            cell.setTo(prev_cell)
                            continue
                        }
                        
                        {
                            ctx.beginPath()
                            ctx.arc(v.x, v.y, camera.z, 0, TAU)
                            ctx.fillStyle = 'rgb(0, 0, 255)'
                            ctx.fill()
                        }

                        if (vi === 0)
                            continue

                        // let char: string
                        let char = '+'
                        let is_diagonal = false
                        let dx = prev_v.x-v.x
                        let dy = prev_v.y-v.y
                        let adx = Math.abs(dx)
                        let ady = Math.abs(dy)
                        let sdx = Math.sign(dx)
                        let sdy = Math.sign(dy)
                        let ad = Math.abs(adx-ady)

                        if (ad < adx && ad < ady) {
                            is_diagonal = true
                        }

                        let cx = prev_cell.x
                        let cy = prev_cell.y


                        for (;;) {

                            let dcx = Math.sign(cell.x-cx)
                            let dcy = Math.sign(cell.y-cy)

                            
                            if (dcx === 0 && dcy === 0) {
                                
                                if (cx >= 0 && cx < cols &&
                                    cy >= 0 && cy < rows
                                ) {
                                    matrix[cx + cy*cols] = char
                                }

                                break
                            }

                            if (is_diagonal) {

                                char = sdx === sdy ? '\\' : '/'

                                if (cx >= 0 && cx < cols &&
                                    cy >= 0 && cy < rows
                                ) {
                                    matrix[cx + cy*cols] = char
                                }

                                cy += dcy
                                cx += dcx
                            } else {

                                if (dcy !== 0 && ccw_segments_intersecting_xy(
                                    prev_v.x, prev_v.y,
                                    v.x, v.y,
                                    grid_pos_x + (cx+1) * cell_size.x, grid_pos_y + (cy + (dcy+1)/2) * cell_size.y,
                                    grid_pos_x + (cx+0) * cell_size.x, grid_pos_y + (cy + (dcy+1)/2) * cell_size.y,
                                )) {
                                    if (dcx === 0) {
                                        char = '|'
                                    } else {
                                        char = dcx === dcy ? '\\' : '/'
                                    }
                                    
                                    if (cx >= 0 && cx < cols &&
                                        cy >= 0 && cy < rows
                                    ) {
                                        matrix[cx + cy*cols] = char
                                    }

                                    cy += dcy
                                }
                                else {
                                    if (dcy === 0) {
                                        char = '―'
                                    } else {
                                        char = dcy === dcx ? '\\' : '/'
                                    }
                                    
                                    if (cx >= 0 && cx < cols &&
                                        cy >= 0 && cy < rows
                                    ) {
                                        matrix[cx + cy*cols] = char
                                    }

                                    cx += dcx
                                }
                            }
                        }
                    }

                    break
                }
                case 'arrow': {

                    ctx.beginPath()
                    ctx.globalAlpha = rendering_shape.opacity

                    let geometry = editor.getShapeGeometry(shape.data)
                    let mat = editor.getShapePageTransform(rendering_shape.id)
                    drawGeometry(geometry.vertices, camera_mat, mat, false)

                    ctx.strokeStyle = theme[shape.data.props.color].solid
                    ctx.lineWidth = 2
                    ctx.stroke()

                    break
                }
                case 'geo': {

                    ctx.beginPath()
                    ctx.globalAlpha = rendering_shape.opacity

                    let geometry = editor.getShapeGeometry(shape.data)
                    let mat = editor.getShapePageTransform(rendering_shape.id)
                    drawGeometry(geometry.vertices, camera_mat, mat, true)

                    ctx.strokeStyle = theme[shape.data.props.color].solid
                    ctx.lineWidth = 2
                    ctx.stroke()

                    break
                }
                case 'line': {

                    ctx.beginPath()
                    ctx.globalAlpha = rendering_shape.opacity

                    let geometry = editor.getShapeGeometry(shape.data)
                    let mat = editor.getShapePageTransform(rendering_shape.id)
                    drawGeometry(geometry.vertices, camera_mat, mat, false)

                    ctx.strokeStyle = theme[shape.data.props.color].solid
                    ctx.lineWidth = 2
                    ctx.stroke()

                    break
                }
                case 'frame':
                case 'embed':
                case 'group':
                case 'highlight':
                case 'image':
                case 'note':
                case 'video': {
                    break
                }
                default: {
                    shape satisfies never
                }
                }
			}

            ctx.font = cell_size.y+'px monospace'
            ctx.fillStyle = 'black'

            for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                let char = matrix[x + y*cols]
                if (char) {
                    ctx.fillText(
                        char,
                        grid_pos_x + x * cell_size.x,
                        grid_pos_y + (y+1) * cell_size.y)
                }
            }
            }

			raf = requestAnimationFrame(render)
		}

		requestAnimationFrame(render)

        window.addEventListener('resize', onResize)

		return () => {
			cancelAnimationFrame(raf)
            window.removeEventListener('resize', onResize)
		}
	}, [editor])

	return <canvas ref={rCanvas} />
}

function CustomShapeIndicator(props: Tldraw.TLShapeIndicatorProps): React.ReactNode {

    console.log('CustomShapeIndicator', props)

    return <></>
}

export function App() {
	return (
		<div className="tldraw__editor">
			<Tldraw.Tldraw
				persistenceKey="asciidraw"
				components={{
                    Background: CustomBackground,
                    // ShapeIndicator: CustomShapeIndicator,
                }}
			/>
		</div>
	)
}
