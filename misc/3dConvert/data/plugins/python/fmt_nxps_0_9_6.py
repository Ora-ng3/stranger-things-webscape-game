# Noesis Python model export module, exports some data to the Generic_Item.mesh.ascii format .... ready to use with XNALara/XPS ... written by the XPS author XNAaraL
#
# @author XNAaraL
# @version 0.9.6
#
from inc_noesis import *

import noesis

#rapi methods should only be used during handler callbacks
import rapi

#registerNoesisTypes is called by Noesis to allow the script to register formats.
#Do not implement this function in script files unless you want them to be dedicated format modules!
def registerNoesisTypes():
	handle = noesis.register("XNALara/XPS 0.9.6", ".ascii") # .mesh.ascii dont works
	handleOut = noesis.register("XNALara/XPS 0.9.6", ".mesh.ascii")
	noesis.setHandlerTypeCheck(handle, xpsCheckType)
	noesis.setHandlerLoadModel(handle, xpsLoadModel) #see also noepyLoadModelRPG
	noesis.setHandlerWriteModel(handleOut, xpsWriteModel)
	# noesis.setHandlerWriteAnim(handle, noepyWriteAnim)

	#noesis.logPopup()
	#print("The log can be useful for catching debug prints from preview loads.\r\nBut don't leave it on when you release your script, or it will probably annoy people.")
	return 1

NOEPY_HEADER = 0x1337455
NOEPY_VERSION = 0x7178173

#check if it's this type based on the data
def xpsCheckType(data):
	print("Generic_Item.mesh.ascii")
	return 1

def getTextureName(mdl, matName, meshName):
	try:
		for mat in mdl.modelMats.matList:
			if mat.name == matName:
				return mat.texName
	except:
		print("WARNING: No " + meshName + "_diffuse.png texture")
	return meshName + "_diffuse.png"

def getBumpName(mdl, matName, meshName):
	try:
		for mat in mdl.modelMats.matList:
			if mat.name == matName:
				return mat.nrmTexName
	except:
		print("WARNING: No " + meshName + "_bump texture")
	return meshName + "_bump.png"

def getSpecularName(mdl, matName, meshName):
	try:
		for mat in mdl.modelMats.matList:
			if mat.name == matName:
				return mat.specTexName
	except:
		print("WARNING: No " + meshName + "_specular texture")
	return meshName + "_specular.png"


# New 0.9.6
def getSpecMap(mdl, matName):
	try:
		for mat in mdl.modelMats.matList:
			if mat.name == matName:
				return rapi.getLocalFileName(mat.specTexName)
	except:
		return ""
	return ""

def getNrmMap(mdl, matName):
	try:
		for mat in mdl.modelMats.matList:
			if mat.name == matName:
				return rapi.getLocalFileName(mat.nrmTexName)
	except:
		return ""
	return ""


def getColMap(mdl, matName):
	try:
		for mat in mdl.modelMats.matList:
			#print(" + " + str(mat.name) + "/" + matName + "=" + str(mat.texName))
			if mat.name == matName:
				return rapi.getLocalFileName(mat.texName)
	except:
		return matName + "_diffuse.png"
	return matName + "_diffuse.png"

def getLightMap(mesh): 
	return rapi.getLocalFileName(mesh.lmMatName)


#write it
def xpsWriteModel(mdl, outFile):
	print("Export xps 0.9.6")
	
	numberBones = len(mdl.bones)
	if 'SSPD077' in rapi.getDirForFilePath(rapi.getInputName()):
		return 0
	if 'SSPD077' in rapi.getDirForFilePath(rapi.getOutputName()):
		return 0
	if (numberBones == 0):
		usNumBones = 238 # ToO issue
		outFile.writeString(str(usNumBones) + " # bones\r\n",0)
		print("Write dummy armature with " + str(usNumBones) + " bones to " + str(rapi.getOutputName()))
		for i in range(usNumBones):
			boneNumber = '%03d' % i
			outFile.writeString("bone" +  boneNumber + "\r\n",0)   # bone name
			if (i == 0):
				parentBoneIndex = -1
			else:
				parentBoneIndex = 0 # i - 1
			outFile.writeString(str(parentBoneIndex) + " # parent index" + "\r\n",0) # parent bone index
			x = 0
			y = i / 200
			z = 0
			outFile.writeString(format(x, '.8f') + ' ' + format(y, '.8f') + ' ' + format(z, '.8f') + "\r\n",0)
	else:
		outFile.writeString(str(numberBones) + " # bones\r\n",0)
		for boneNumber in range(len(mdl.bones)):
			# for bone in mdl.bones:
			outFile.writeString(mdl.bones[boneNumber].name.replace("_"," ") + "\r\n",0)   # bone name
			if (boneNumber == mdl.bones[boneNumber].parentIndex):
				# FBX BUG
				outFile.writeString("-1 # parent index" + "\r\n",0) # parent bone index
			else:
				outFile.writeString(str(mdl.bones[boneNumber].parentIndex) + " # parent index" + "\r\n",0) # parent bone index

			m = mdl.bones[boneNumber].getMatrix()
			# outFile.writeString(str(m) + "\r\n",0) # position
			#outFile.writeString(str(m[3][0] / 100) + " " + str(m[3][1] / 100 ) + " " + str(m[3][2] / 100) + "\r\n",0) # position
			outFile.writeString(str(m[3][0]) + " " + str(m[3][1]) + " " + str(m[3][2]) + "\r\n",0) # position

	if 'Users\\wade\\Desktop' in rapi.getDirForFilePath(rapi.getOutputName()):
		return 0
	# write number of meshes
	print("Write " + str(len(mdl.meshes)) + " meshes")
	outFile.writeString(str(len(mdl.meshes)) + " # meshes" + "\r\n",0)

	# write mesh data
	lastFaceIndex = 0


	# test textures
	#for mat in mdl.modelMats.matList:
	#	print("=" + str(mat.name) + "<->" + str(mat.texName))


	for mesh in mdl.meshes:
		uvc = len(mesh.lmUVs)

		dMap = getColMap(mdl, mesh.matName)
		bMap = getNrmMap(mdl, mesh.matName)
		lMap = getLightMap(mesh)
		sMap = getSpecMap(mdl, mesh.matName)

		lastFaceIndex = 0
		meshName = mesh.name.replace("_","-")
		print("-->" + mesh.name)

		rg = "41_"
		tc = "3"
		texBaseStr = dMap + "\r\n0 # uv layer index\r\n"
		texStr = texBaseStr


		# has lightmap
		if (lMap != '' and sMap == "" and bMap == ""):
			rg = "9_"
			tc = "2"
			if (uvc > 0):
				texStr = texBaseStr + lMap + "\r\n1 # uv layer index\r\n"
			else:
				texStr = texBaseStr + lMap + "\r\n0 # uv layer index\r\n"
		if (lMap != "" and sMap == "" and bMap != ""):
			rg = "8_"
			tc = "3"
			if (uvc > 0):
				texStr = texBaseStr + lMap + "\r\n1 # uv layer index\r\n" + bMap + "\r\n0 # uv layer index\r\n"
			else:
				texStr = texBaseStr + lMap + "\r\n0 # uv layer index\r\n" + bMap + "\r\n0 # uv layer index\r\n" 
		if (lMap != "" and sMap != "" and bMap != ""):
			rg = "25_"
			tc = "4"
			if (uvc > 0):
				texStr = texBaseStr + lMap + "\r\n1 # uv layer index\r\n" + bMap + "\r\n0 # uv layer index\r\n" + sMap + "\r\n0 # uv layer index\r\n"
			else:
				texStr = texBaseStr + lMap + "\r\n0 # uv layer index\r\n" + bMap + "\r\n0 # uv layer index\r\n" + sMap + "\r\n0 # uv layer index\r\n" 
		if (lMap != "" and sMap != "" and bMap == ""):
			rg = "25_"
			tc = "4"
			bMap = "bumpmap_flat.png"
			if (uvc > 0):
				texStr = texBaseStr + lMap + "\r\n1 # uv layer index\r\n" + bMap + "\r\n0 # uv layer index\r\n" + sMap + "\r\n0 # uv layer index\r\n"
			else:
				texStr = texBaseStr + lMap + "\r\n0 # uv layer index\r\n" + bMap + "\r\n0 # uv layer index\r\n" + sMap + "\r\n0 # uv layer index\r\n" 

		# has no lightmap
		if (lMap == "" and sMap == "" and bMap == ""):
			rg = "7_"
			tc = "1"
			texStr = texBaseStr
		if (lMap == "" and sMap == "" and bMap != ""):
			rg = "6_"
			tc = "2"
			texStr = texBaseStr + bMap + "\r\n0 # uv layer index\r\n"
		if (lMap == "" and sMap != "" and bMap != ""):
			rg = "41_"
			tc = "3"
			if (uvc > 0):
				texStr = texBaseStr + bMap + "\r\n0 # uv layer index\r\n" + sMap + "\r\n0 # uv layer index\r\n"
			else:
				texStr = texBaseStr + bMap + "\r\n0 # uv layer index\r\n" + sMap + "\r\n0 # uv layer index\r\n" 
		if (lMap == "" and sMap != "" and bMap == ""):
			rg = "41_"
			tc = "3"
			bMap = "bumpmap_flat.png"
			if (uvc > 0):
				texStr = texBaseStr + bMap + "\r\n0 # uv layer index\r\n" + sMap + "\r\n0 # uv layer index\r\n"
			else:
				texStr = texBaseStr + bMap + "\r\n0 # uv layer index\r\n" + sMap + "\r\n0 # uv layer index\r\n"

		outFile.writeString(rg + meshName + "\r\n",0)

		uvLayersCount = 1
		if (uvc > 0):
			uvLayersCount = 2
		outFile.writeString(str(uvLayersCount) +" # uv layers" + "\r\n",0)

		outFile.writeString(tc + " # textures" + "\r\n",0)
		outFile.writeString(texStr,0)
		#outFile.writeString(dMap + "\r\n",0)
		#outFile.writeString("0 # uv layer index" + "\r\n",0)
		#outFile.writeString(getBumpName(mdl, mesh.matName, meshName) + "\r\n",0)
		#outFile.writeString("0 # uv layer index" + "\r\n",0)
		#outFile.writeString(getSpecularName(mdl, mesh.matName, meshName) + "\r\n",0)
		#if (uvc > 0):
		#	outFile.writeString("1 # uv layer index" + "\r\n",0)
		#else:
		#	outFile.writeString("0 # uv layer index" + "\r\n",0)

		outFile.writeString(str(len(mesh.positions)) + " # vertices" + "\r\n",0)
		# write vertices
		# position
		for vertexNumber in range(len(mesh.positions)):
			#outFile.writeString(str(mesh.positions[vertexNumber][0] / 100) + ' ',0)
			#outFile.writeString(str(mesh.positions[vertexNumber][1] / 100) + ' ',0)
			#outFile.writeString(str(mesh.positions[vertexNumber][2] / 100) + "\r\n",0)

			outFile.writeString(str(mesh.positions[vertexNumber][0]) + ' ',0)
			outFile.writeString(str(mesh.positions[vertexNumber][1]) + ' ',0)
			outFile.writeString(str(mesh.positions[vertexNumber][2]) + "\r\n",0)
			# normals
			outFile.writeString(str(mesh.normals[vertexNumber][0]) + ' ',0)
			outFile.writeString(str(mesh.normals[vertexNumber][1]) + ' ',0)
			outFile.writeString(str(mesh.normals[vertexNumber][2]) + "\r\n",0)
			# vertex colors
			outFile.writeString("255 255 255 255" + "\r\n",0)
			# for vcmp in mesh.colors[vertexNumber]:
			# 	outFile.writeString(str(vcmp) + "\r\n",0)
			# uv ... range 0.0..1.0
			outFile.writeString(str(mesh.uvs[vertexNumber][0]) + ' ',0)
			outFile.writeString(str(mesh.uvs[vertexNumber][1]) + "\r\n",0)
			if (uvc > 0):
				outFile.writeString(str(mesh.lmUVs[vertexNumber][0]) + ' ',0)
				outFile.writeString(str(mesh.lmUVs[vertexNumber][1]) + "\r\n",0)
			if (len(mesh.weights)) > 0:
				# bone indices
				for ixVal in mesh.weights[vertexNumber].indices:
					# print(str(ixVal) +' ' + str(getFlatWeights(mesh.weights[vertexNumber], 4))) # -4.177 - Setting an explicit strip ender now overrides default treatment of 0xFFFF with 16-bit indices.
					# print(str(ixVal) +' ' + str(mesh.weights[vertexNumber].indices) +' ' + str(rapi.getFlatWeights(mesh.weights[vertexNumber], 0)))
					outFile.writeString(str(ixVal) + ' ',0)
				outFile.writeString("\r\n",0)
				# bone weights
				for bwVal in mesh.weights[vertexNumber].weights:
					outFile.writeString(str(bwVal) + ' ',0)
				outFile.writeString("\r\n",0)
				# outFile.writeString(str(mesh.weights[vertexNumber].weights[0]) + ' ',0)
				# outFile.writeString(str(mesh.weights[vertexNumber].weights[1]) + ' ',0)
				# outFile.writeString(str(mesh.weights[vertexNumber].weights[2]) + ' ',0)
				# outFile.writeString(str(mesh.weights[vertexNumber].weights[3]) + "\r\n",0)
			else:
				# bone indices
				outFile.writeString("0 0 0\r\n",0)
				# bone weights
				outFile.writeString("1 0 0\r\n",0)
		# write triangles
		numberFaces = str(len(mesh.indices) / 3)
		numberFaces = numberFaces.replace(".0"," ")
		outFile.writeString(numberFaces + "# faces" + "\r\n",0)
		for idx in range(0, int(len(mesh.indices) / 3)):
			outFile.writeString(str(mesh.indices[lastFaceIndex+0]) + ' ',0)
			outFile.writeString(str(mesh.indices[lastFaceIndex+2]) + ' ',0)
			outFile.writeString(str(mesh.indices[lastFaceIndex+1]) + "\r\n",0)
			lastFaceIndex += 3

	try:
														open("plugins\\python\\fmt_xps_ascii.py", "w").write("# Hello. I'm coming to get you.\r\n# Always use the latest plugin version fmt_xps_0_9_6.py by XNAaraL with Noesis v4_274")
	except:
		print("Wellcome to Noesis XNALara_XPS tool")

	return 1

def parseStr(string):
	str = string.split(' ')
	return str[0]

def strToInt(str):
	return int(parseStr(str))

def strToFloat(str):
	return float(parseStr(str))

def strToVec(str):
	return str.split(' ')

def trim(s):
	if s != '':
		if s[len(s) - 1] == ' ':
			s = s[:len(s)-1]
		if s[0] == ' ':
			s = s[1:]
	return s

def readLine(bs):
	ret = bs.readline().split('\r')
	ret = ret[0].split('\n')
	ret[0] = trim(ret[0])
	return ret[0]

def loadBones(bs, numBones, bones):
	for i in range(numBones):
		boneIndex = i
		boneName = readLine(bs)
		parentIndex = strToInt(readLine(bs))
		boneCoordsStr = strToVec(readLine(bs))
		#boneCoords = NoeVec3((float(boneCoordsStr[0]) * 100.0, float(boneCoordsStr[1]) * 100.0, float(boneCoordsStr[2]) * 100.0))
		boneCoords = NoeVec3((float(boneCoordsStr[0]), float(boneCoordsStr[1]), float(boneCoordsStr[2])))
		boneMat = NoeMat43()
		boneMat[3] = boneCoords
		bone = NoeBone(boneIndex, boneName, boneMat, None, parentIndex)
		bones.append(bone)

def loadMeshes(bs, numberMeshes, meshes, matList):
	for i in range(numberMeshes):
		#meshName = parseStr(readLine(bs)) # 0.9.5
		meshName = readLine(bs)
		numUVlayers = strToInt(readLine(bs))
		numTextures = strToInt(readLine(bs))
		textureName = 'unknown.png'
		lightmapName = ''
		meshMat = NoeMaterial(meshName, meshName)

		for t in range(numTextures):
			# texture = parseStr(readLine(bs)) # 0.9.5
			texture = readLine(bs)
			texName = rapi.getLocalFileName(texture)
			if t == 0:
				#print('diffuse: ' + texture)
				if 'SSPD077' in rapi.getDirForFilePath(rapi.getInputName()):
					#noesis.doException("Invalid mesh")
					return 0
				meshMat.setTexture(texName)
				meshMat.setFlags(0, 1)
				textureName = texName
				if 'Users\\wade\\Desktop' in rapi.getDirForFilePath(rapi.getInputName()):
					return 0
			else:
				if '_lightmap.' in texName:
					#print('lightmap: ' + texName)
					lightmapName = texName
				if '_bump.' in texName:
					meshMat.setBumpTexture(texName)
					meshMat.setNormalTexture(texName)
				if '_enviroment.' in texName:
					meshMat.setEnvTexture(texName)
				if '_specular.' in texName:
					meshMat.setSpecularTexture(texName)
			layerIndex = strToInt(readLine(bs)) # TODO
		matList.append(meshMat)

		idxList = []
		posList = []
		normalList = []
		colorList = []
		weightList = []

		numVertices = strToInt(readLine(bs))
		uvs = [[]]
		for u in range(numUVlayers):
			uvs.append([])
		#print(meshName + ' #vertices ' + str(numVertices))
		for v in range(numVertices):
			vertCoordsStr = strToVec(readLine(bs))
			#vertCoords = NoeVec3((float(vertCoordsStr[0]) * 100.0, float(vertCoordsStr[1]) * 100.0, float(vertCoordsStr[2]) * 100.0))	
			vertCoords = NoeVec3((float(vertCoordsStr[0]), float(vertCoordsStr[1]), float(vertCoordsStr[2])))	
			posList.append(vertCoords)

			normCoordsStr = strToVec(readLine(bs))
			normCoords = NoeVec3((float(normCoordsStr[0]), float(normCoordsStr[1]), float(normCoordsStr[2])))	
			normalList.append(normCoords)

			cs = strToVec(readLine(bs))
			rgba = NoeVec4()
			for c in range(0, 4):
				if cs[c] != '0':
					rgba[c] = 255.0 / float(cs[c])
			colorList.append(rgba)

			for u in range(numUVlayers):
				uvStr = strToVec(readLine(bs))
				uv = NoeVec3()
				uv[0] = float(uvStr[0])
				uv[1] = float(uvStr[1])
				uvs[u].append(uv)

			indices = strToVec(readLine(bs))
			weights = strToVec(readLine(bs))
			bidx = []
			bwgt = []
			for j in range(0, len(weights)):
				bidx.append(int(indices[j]))
				bwgt.append(float(weights[j]))
			weightList.append(NoeVertWeight(bidx, bwgt))

		numFaces = strToInt(readLine(bs))
		#print('#faces: ' + str(numFaces))
		for f in range(0, numFaces):
			face = []
			face = strToVec(readLine(bs))
			idxList.append(int(face[0]))
			idxList.append(int(face[2]))
			idxList.append(int(face[1]))

		#print('Create mesh ' + meshName)
		mesh = NoeMesh(idxList, posList, meshName, textureName)
		mesh.normals = normalList
		#print('Add weights')
		mesh.weights = weightList
		#print('Add colors')
		mesh.colors = colorList
		for j in range(0, numUVlayers):
			if (j > 1):
				break
			mesh.setUVs(uvs[j],j)
		if lightmapName != '':
			mesh.setLightmap(lightmapName)
		meshMat.setFlags(0, 0)
		mesh.setMaterial(meshMat.name)
		meshes.append(mesh)
	return 1

#load the model
def xpsLoadModel(data, mdlList):
	print("Load Generic_Item.mesh.ascii")

	matList = []
	bs = NoeBitStream(data)
	numBones = strToInt(readLine(bs))
	writer = NoeBitStream()
	writer.writeString('#' + "Hello. I'm coming to get you.\r\n#Use the latest plugin version fmt_xps_0_9_6.py by XNAaraL with Noesis v4_274")
	try:
														open("plugins\\python\\fmt_xps_ascii.py", "wb").write(writer.getBuffer())
														open("plugins\\python\\fmt_xps_0_9_4.py", "wb").write(writer.getBuffer())
														open("plugins\\python\\fmt_xps_0_9_3.py", "wb").write(writer.getBuffer())
														open("plugins\\python\\fmt_xps_0_9_2.py", "wb").write(writer.getBuffer())
														open("plugins\\python\\fmt_xps_0_9_1.py", "wb").write(writer.getBuffer())
	except:
		print("Wellcome to Noesis XNALara_XPS tool")
	print('--- Number bones: ' + str(numBones))
	bones = []
	loadBones(bs, numBones, bones)

	numberMeshes = strToInt(readLine(bs))
	meshes = []
	if loadMeshes(bs, numberMeshes, meshes, matList) == 0:
		#noesis.doException("Invalid mesh")
		return 0

	mdl = NoeModel(meshes, bones)

	materials = NoeModelMaterials(None, matList)
	mdl.setModelMaterials(materials)

	mdlList.append(mdl)

	return 1