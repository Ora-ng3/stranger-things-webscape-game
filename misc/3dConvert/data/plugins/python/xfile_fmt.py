#by Durik256
from inc_noesis import *
import sys
import struct
import array
import os
import xfile_parser

def registerNoesisTypes():
    handle = noesis.register("DirectX", ".x")
    noesis.setHandlerTypeCheck(handle, CheckType)
    noesis.setHandlerLoadModel(handle, LoadModel)
    return 1

def CheckType(data):
    return 1

def LoadModel(data, mdlList):
    #if data[9:12] == b'zip':
    #    command = 'xfile_tool.exe "' + rapi.getInputName() + '" -d'
    #    os.system(command)
    #    print(command)
    
    bs = NoeBitStream(data)
    ctx = rapi.rpgCreateContext()
    #rapi.rpgSetOption(noesis.RPGOPT_SWAPHANDEDNESS, 2)
    global bones, meshes, materials
    bones, meshes, materials = [], [], []
    
    parser = xfile_parser.XFileParser(data)
    oldScene = parser.getImportedData()
    
    for x in oldScene.globalMeshes:
        meshes.append(x)
        #print('global mesh:',x)
        
    for x in oldScene.globalMaterials:
        convert_material(x)
    
    convert_node(oldScene.rootNode)
    
    if bones:
        bones = rapi.multiplyBones(bones)
    #for b in bones:
    #    if b.parentName:
    #        b.setMatrix(b.getMatrix()*bones[getBoneIndex(b.parentName)].getMatrix())
    #getBoneIndex(name)
    for i,x in enumerate(meshes):
        convert_mesh(x, i)
    x
    try: mdl = rapi.rpgConstructModel()
    except: mdl = NoeModel()

    #mdl.setAnims(anims)
    mdl.setBones(bones)
    mdl.setModelMaterials(NoeModelMaterials([], materials))
    mdlList.append(mdl)
    return 1

def convert_node(node):
    if not node:
        return
    
    #print('node:', node.name, 'parent:', node.parent.name if node.parent else 'None')
    matrix  = NoeMat43()
    if node.trafoMatrix:
        matrix = NoeMat44.fromBytes(noePack('16f', *node.trafoMatrix)).toMat43()#.swapHandedness(2)
    
    if getBoneIndex(node.name) != -1:
        node.name = node.name + str(len(bones))
    bones.append(NoeBone(len(bones), node.name, matrix, node.parent.name if node.parent else None))
    for mesh in node.meshes:
        meshes.append(mesh)

    for child in node.children:
        convert_node(child)
    return 1
        
def convert_mesh(mesh, i):
    rapi.rpgSetName('name_%i'%i)
    
    vnum = len(mesh.positions)
    if not vnum:
        return 1
        
    for n,x in enumerate(mesh.materials):
        print(x.name)
        convert_material(x)
    
    newVert = [NoeVec3()]*vnum
    
    if bones and mesh.bones:
        weight, maxW = [], 1
        for x in range(vnum):
            weight.append([[],[]])
        for bone in mesh.bones:
            idBone = getBoneIndex(bone.name)
            mat_ofs = NoeMat44.fromBytes(noePack('16f', *bone.offsetMatrix)).toMat43()
            
            for x in bone.weights:
                newVert[x.vertex] += (mat_ofs*(bones[idBone].getMatrix())*x.weight).transformPoint(NoeVec3(mesh.positions[x.vertex]))#.getStorage()
                weight[x.vertex][0].append(idBone)
                weight[x.vertex][1].append(x.weight)
                maxW = max(maxW, len(weight[x.vertex][0]))
        
        
        wbuf = b''
        for w in weight:
            w[0] = w[0] + [0]*(maxW-len(w[0]))
            w[1] = w[1] + [0]*(maxW-len(w[1]))
            wbuf += noePack('%iH'%maxW, *w[0])
            wbuf += noePack('%if'%maxW, *w[1])
        
        rapi.rpgBindBoneIndexBuffer(wbuf, noesis.RPGEODATA_USHORT, (maxW*6), maxW)
        rapi.rpgBindBoneWeightBufferOfs(wbuf, noesis.RPGEODATA_FLOAT, (maxW*6), maxW*2, maxW)
    
        vbuf = b''
        #for x in mesh.positions:
        #    vbuf += NoeVec3(x).toBytes()
        
        for x in newVert:#mesh.positions:
            vbuf += x.toBytes()#NoeVec3(x).toBytes()
    else:
        vbuf = b''
        for x in mesh.positions:
            vbuf += NoeVec3(x).toBytes()
    
    rapi.rpgBindPositionBuffer(vbuf, noesis.RPGEODATA_FLOAT, 12)
    
    if mesh.texCoords and len(mesh.texCoords) == vnum:
        uvbuf = b''
        for x in mesh.texCoords:
            uvbuf += noePack('2f', x[0], x[1])
        rapi.rpgBindUV1Buffer(uvbuf, noesis.RPGEODATA_FLOAT, 8)
    else:
        uvbuf = b'\x00\x00'*vnum
        rapi.rpgBindUV1Buffer(uvbuf, noesis.RPGEODATA_BYTE, 2)
    
    #print(mesh.faceMaterials)
    if mesh.numMaterials < 2:
        try:
            rapi.rpgSetMaterial(mesh.materials[0].name)
        except:
            rapi.rpgSetMaterial('mat_%i_0'%i)
        
        ibuf = b''
        for x in mesh.posFaces:
            if len(x.indices) == 3:
                ibuf += noePack('3H', *x.indices)
            else:
                for f in triangulate_polygon(x.indices):
                    ibuf += noePack('3H', *f)
        
        rapi.rpgCommitTriangles(ibuf, noesis.RPGEODATA_USHORT, len(ibuf)//2, noesis.RPGEO_TRIANGLE)
    else:
        mat_indx = {}
        for x in range(mesh.numMaterials):
            mat_indx[x] = b''
        for n,x in enumerate(mesh.faceMaterials):
            face = mesh.posFaces[n].indices
            if len(face) == 3:
                mat_indx[x] += noePack('3H', *face)
            else:
                for f in triangulate_polygon(face):
                    mat_indx[x] += noePack('3H', *f)

        for n,ibuf in enumerate(mat_indx.values()):
            try:
                rapi.rpgSetMaterial(mesh.materials[n].name)
            except:
                rapi.rpgSetMaterial('mat_%i_%i'%(i,n))
            try:
                rapi.rpgCommitTriangles(ibuf, noesis.RPGEODATA_USHORT, len(ibuf)//2, noesis.RPGEO_TRIANGLE)
            except: pass
    return 1
        
def triangulate_polygon(vertex_indices):
    triangles = []
    
    # Проверка, что у нас достаточно вершин для построения треугольников
    if len(vertex_indices) < 3:
        raise ValueError("Недостаточно вершин для построения треугольников")
    
    # Триангуляция полигона
    for i in range(1, len(vertex_indices) - 1):
        triangle = [vertex_indices[0], vertex_indices[i], vertex_indices[i + 1]]
        triangles.append(triangle)
    
    return triangles
        
def convert_material(raw_mat, name=None):
    if not name:
        name = raw_mat.name
    mat = NoeMaterial(name, '')
        
    for x in raw_mat.textures:
        name = x.name.decode('ascii', 'ignore')
        if not x.isNormalMap:
            mat.setTexture(name)
            print(name)
        else:
            mat.setNormalTexture(name)
    
    mat.setDiffuseColor(NoeVec4(raw_mat.diffuse))
    mat.setSpecularColor(NoeVec4(list(raw_mat.specular) + [raw_mat.specularExponent]))
    #raw_mat.sceneIndex
    materials.append(mat)
    return 1
    
def getBoneIndex(name):
    for i,bone in enumerate(bones):
        if name == bone.name:
            return bone.index
    return -1