// 新アシスタント作成モーダル
{
  /* 新アシスタント作成モーダル */
}
;<Modal isOpen={isModalOpen} onClose={closeCustomChatModal} size="lg">
  <ModalOverlay />
  <ModalContent>
    <ModalHeader>{t('modal.newAssistant.title')}</ModalHeader>
    <ModalBody>
      <FormControl mb={4}>
        <FormLabel>{t('modal.newAssistant.assistantName')}</FormLabel>
        <Input
          value={modalChatTitle}
          onChange={(e) => setModalChatTitle(e.target.value)}
          placeholder={t('modal.newAssistant.assistantNamePlaceholder')}
        />
      </FormControl>
      <FormControl mb={4}>
        <FormLabel>{t('modal.newAssistant.systemPrompt')}</FormLabel>
        <Textarea
          value={modalSystemPrompt}
          onChange={(e) => setModalSystemPrompt(e.target.value)}
          placeholder={t('modal.newAssistant.systemPromptPlaceholder')}
          rows={10}
        />
      </FormControl>
      <FormControl mb={4}>
        <FormLabel>{t('modal.newAssistant.agentFiles')}</FormLabel>
        <Box>
          <Button size="sm" colorScheme="blue" onClick={handleSelectAgentFiles}>
            {t('modal.newAssistant.selectFile')}
          </Button>
          {modalAgentFiles.length === 0 ? (
            <Text fontSize="sm" color="gray.500" mt={2}>
              {t('modal.newAssistant.noFiles')}
            </Text>
          ) : (
            <List mt={2}>
              {modalAgentFiles.map((f) => (
                <ListItem key={f.path} fontSize="sm">
                  {f.name}
                  <Button
                    size="xs"
                    colorScheme="red"
                    ml={2}
                    onClick={() => handleRemoveAgentFile(f.path)}
                  >
                    {t('common.delete')}
                  </Button>
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      </FormControl>

      {/* 外部API機能が有効な場合のみ表示 */}
      {isExternalApiEnabled && (
        <>
          <FormControl mb={4}>
            <HStack align="flex-start">
              <FormLabel mb={0}>{t('modal.newAssistant.enableApiCall')}</FormLabel>
              <Switch
                isChecked={modalEnableAPICall}
                onChange={(e) => setModalEnableAPICall(e.target.checked)}
              />
            </HStack>
            {modalEnableAPICall && (
              <Box mt={2}>
                <Button
                  size="sm"
                  colorScheme="teal"
                  onClick={() => setIsCreateAPISettingsOpen(true)}
                >
                  {t('modal.newAssistant.apiSettings')}
                </Button>
              </Box>
            )}
          </FormControl>
        </>
      )}
    </ModalBody>
    <ModalFooter>
      <Button variant="ghost" onClick={closeCustomChatModal}>
        {t('modal.newAssistant.cancel')}
      </Button>
      <Button colorScheme="blue" onClick={handleCreateCustomChat} ml={3}>
        {t('modal.newAssistant.create')}
      </Button>
    </ModalFooter>
  </ModalContent>
</Modal>

// 削除確認モーダル
{
  /* 削除確認モーダル */
}
;<Modal isOpen={isDeleteModalOpen} onClose={closeDeleteModal} isCentered>
  <ModalOverlay />
  <ModalContent>
    <ModalHeader>{t('modal.deleteAssistant.title')}</ModalHeader>
    <ModalBody>
      <Text>{t('modal.deleteAssistant.message')}</Text>
    </ModalBody>
    <ModalFooter>
      <Button variant="ghost" onClick={closeDeleteModal}>
        {t('modal.deleteAssistant.cancel')}
      </Button>
      <Button colorScheme="red" ml={3} onClick={confirmDeleteChat}>
        {t('modal.deleteAssistant.delete')}
      </Button>
    </ModalFooter>
  </ModalContent>
</Modal>

// システムプロンプト編集モーダル
{
  /* システムプロンプト編集モーダル */
}
;<Modal isOpen={isPromptModalOpen} onClose={closeSystemPromptModal} size="lg">
  <ModalOverlay />
  <ModalContent>
    <ModalHeader>{t('modal.editAssistant.title')}</ModalHeader>
    <ModalBody>
      <FormControl mb={4}>
        <FormLabel>{t('modal.editAssistant.assistantName')}</FormLabel>
        <Input
          value={editingCustomTitle}
          onChange={(e) => setEditingCustomTitle(e.target.value)}
          placeholder={t('modal.editAssistant.assistantName')}
        />
      </FormControl>
      <FormControl mb={4}>
        <FormLabel>{t('modal.editAssistant.systemPrompt')}</FormLabel>
        <Textarea
          value={editingSystemPrompt}
          onChange={(e) => setEditingSystemPrompt(e.target.value)}
          placeholder={t('modal.editAssistant.systemPromptPlaceholder')}
          rows={10}
        />
      </FormControl>
      <FormControl mb={4}>
        <FormLabel>{t('modal.editAssistant.agentFiles')}</FormLabel>
        <Box>
          <Button size="sm" colorScheme="blue" onClick={handleAddAgentFileInPrompt}>
            {t('modal.editAssistant.selectFile')}
          </Button>
          {editingAgentFiles.length === 0 ? (
            <Text fontSize="sm" color="gray.500" mt={2}>
              {t('modal.editAssistant.noFiles')}
            </Text>
          ) : (
            <List mt={2}>
              {editingAgentFiles.map((f) => (
                <ListItem key={f.path} fontSize="sm">
                  {f.name}
                  <Button
                    size="xs"
                    colorScheme="red"
                    ml={2}
                    onClick={() => handleRemoveAgentFileInPrompt(f.path)}
                  >
                    {t('common.delete')}
                  </Button>
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      </FormControl>
      <Box textAlign="right" mb={4}>
        <Button size="sm" onClick={handleCopySystemPrompt}>
          {t('modal.editAssistant.copyInstructions')}
        </Button>
      </Box>

      {/* 外部API機能が有効な場合のみ表示 */}
      {isExternalApiEnabled && (
        <>
          <FormControl mb={4}>
            <HStack align="flex-start">
              <FormLabel mb={0}>{t('modal.editAssistant.enableApiCall')}</FormLabel>
              <Switch
                isChecked={enableAPICall}
                onChange={(e) => setEnableAPICall(e.target.checked)}
              />
            </HStack>
            {enableAPICall && (
              <Box mt={2}>
                <Button size="sm" colorScheme="teal" onClick={() => setIsAPISettingsOpen(true)}>
                  {t('modal.editAssistant.apiSettings')}
                </Button>
              </Box>
            )}
          </FormControl>
        </>
      )}
    </ModalBody>
    <ModalFooter>
      <Button variant="ghost" onClick={closeSystemPromptModal}>
        {t('modal.editAssistant.cancel')}
      </Button>
      <Button colorScheme="blue" onClick={handleSaveSystemPrompt} ml={3}>
        {t('modal.editAssistant.save')}
      </Button>
    </ModalFooter>
  </ModalContent>
</Modal>
